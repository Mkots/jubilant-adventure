import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type {
    Actor,
    IdGenerator,
    ShopClock,
    ShopRepositories,
    ShopServices,
} from '@jubilant-adventure/shop-domain';
import {
    createInMemoryRepositories,
    createShopServices,
    DomainError,
    SequentialIdGenerator,
    SystemClock,
} from '@jubilant-adventure/shop-domain';
import {
    createBaselineSeed,
    fixturePasswordVerifier,
} from '@jubilant-adventure/test-data';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createAccessToken, verifyAccessToken } from './auth/token';

export type AppEnv = {
    Variables: {
        actor: Actor;
    };
};

export interface ApiRuntime {
    repositories: ShopRepositories;
    services: ShopServices;
    clock: ShopClock;
    idGenerator: IdGenerator;
    tokenSecret: string;
}

export interface AppOptions {
    clock?: ShopClock;
    idGenerator?: IdGenerator;
    repositories?: ShopRepositories;
    tokenSecret?: string;
}

const ErrorSchema = z
    .object({
        code: z.string().openapi({ example: 'invalid_input' }),
        message: z.string().openapi({ example: 'Request validation failed' }),
        fields: z.record(z.string(), z.string()).optional(),
    })
    .openapi('Error');

const UserSchema = z
    .object({
        id: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(['user', 'admin']),
    })
    .openapi('User');

const ProductSchema = z
    .object({
        id: z.string().uuid(),
        name: z.string(),
        description: z.string(),
        category: z.string(),
        price: z.object({
            amount: z.number().int().nonnegative(),
            currency: z.string().length(3),
        }),
        stock: z.number().int().nonnegative(),
        active: z.boolean(),
    })
    .openapi('Product');

const LoginBodySchema = z
    .object({
        email: z.string().email(),
        password: z.string().min(1),
    })
    .openapi('LoginRequest');

const LoginResponseSchema = z
    .object({
        token: z.string(),
        expiresIn: z.number().int().positive(),
        user: UserSchema,
    })
    .openapi('LoginResponse');

const ProductListSchema = z
    .object({
        items: z.array(ProductSchema),
        total: z.number().int().nonnegative(),
        page: z.number().int().positive(),
        pageSize: z.number().int().positive(),
        totalPages: z.number().int().nonnegative(),
    })
    .openapi('ProductList');

const ProductQuerySchema = z
    .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
        category: z.string().optional(),
        sort: z.enum(['name', 'price', 'stock']).optional(),
        direction: z.enum(['asc', 'desc']).optional(),
    })
    .openapi('ProductQuery');

const UUIDParamsSchema = z
    .object({ id: z.string().uuid() })
    .openapi('UUIDParams');

const errorResponse = (
    code: string,
    message: string,
    fields?: Record<string, string>,
) => ({
    code,
    message,
    ...(fields ? { fields } : {}),
});

export const statusForError = (
    error: DomainError,
): 400 | 401 | 403 | 404 | 409 => {
    switch (error.code) {
        case 'invalid_credentials':
            return 401;
        case 'not_found':
            return 404;
        case 'forbidden':
            return 403;
        case 'conflict':
        case 'insufficient_stock':
        case 'empty_cart':
        case 'invalid_transition':
            return 409;
        default:
            return 400;
    }
};

const validationError = (issues: { path: PropertyKey[]; message: string }[]) =>
    errorResponse(
        'invalid_input',
        'Request validation failed',
        Object.fromEntries(
            issues.map((issue) => [
                issue.path.join('.') || 'request',
                issue.message,
            ]),
        ),
    );

export const createRuntime = (options: AppOptions = {}): ApiRuntime => {
    const repositories = options.repositories ?? createInMemoryRepositories();
    const seed = createBaselineSeed();
    repositories.users.reset(seed.users);
    repositories.products.reset(seed.products);
    repositories.carts.reset(seed.carts);
    repositories.orders.reset(seed.orders);
    const clock = options.clock ?? new SystemClock();
    const idGenerator = options.idGenerator ?? new SequentialIdGenerator();
    return {
        repositories,
        services: createShopServices(
            repositories,
            clock,
            idGenerator,
            fixturePasswordVerifier,
        ),
        clock,
        idGenerator,
        tokenSecret: options.tokenSecret ?? 'local-development-secret',
    };
};

export const authMiddleware =
    (runtime: ApiRuntime): MiddlewareHandler<AppEnv> =>
    async (c, next) => {
        const authorization = c.req.header('Authorization');
        const token = authorization?.startsWith('Bearer ')
            ? authorization.slice('Bearer '.length)
            : undefined;
        const actor = token
            ? verifyAccessToken(token, runtime.tokenSecret, runtime.clock.now())
            : undefined;
        if (!actor) {
            return c.json(
                errorResponse('unauthorized', 'Authentication is required'),
                401,
            );
        }
        c.set('actor', actor);
        await next();
        return undefined;
    };

const registerSampleRoutes = (app: OpenAPIHono<AppEnv>): void => {
    app.get('/sample', (c) => {
        const url = new URL(c.req.url);
        return c.json(
            {
                trimmedPath: url.pathname.replace(/^\/+|\/+$/g, ''),
                method: c.req.method,
                queryStringObject: Object.fromEntries(url.searchParams),
                payload: '',
            },
            406,
        );
    });
    app.get('/sample/hello', (c) => c.json({ message: 'Hello' }, 406));
};

const registerBusinessRoutes = (
    app: OpenAPIHono<AppEnv>,
    runtime: ApiRuntime,
): void => {
    const loginRoute = createRoute({
        method: 'post',
        path: '/auth/login',
        request: {
            body: {
                content: {
                    'application/json': { schema: LoginBodySchema },
                },
            },
        },
        responses: {
            200: {
                content: {
                    'application/json': { schema: LoginResponseSchema },
                },
                description: 'Authenticated user and access token',
            },
            400: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Malformed login request',
            },
            401: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Invalid credentials',
            },
        },
    });

    app.openapi(loginRoute, (c) => {
        const body = c.req.valid('json');
        const user = runtime.services.auth.verifyCredentials(
            body.email,
            body.password,
        );
        const token = createAccessToken(
            { userId: user.id, role: user.role },
            runtime.tokenSecret,
            runtime.clock.now(),
        );
        return c.json({ token, expiresIn: 900, user }, 200);
    });

    const productsRoute = createRoute({
        method: 'get',
        path: '/products',
        request: { query: ProductQuerySchema },
        responses: {
            200: {
                content: { 'application/json': { schema: ProductListSchema } },
                description: 'Paginated product catalog',
            },
            400: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Invalid product query',
            },
        },
    });

    app.openapi(productsRoute, (c) =>
        c.json(runtime.services.products.list(c.req.valid('query')), 200),
    );

    const productByIdRoute = createRoute({
        method: 'get',
        path: '/products/{id}',
        request: { params: UUIDParamsSchema },
        responses: {
            200: {
                content: { 'application/json': { schema: ProductSchema } },
                description: 'Product details',
            },
            400: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Malformed product ID',
            },
            404: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Product not found',
            },
        },
    });

    app.openapi(productByIdRoute, (c) =>
        c.json(runtime.services.products.getById(c.req.valid('param').id), 200),
    );
};

export const createApp = (options: AppOptions = {}): OpenAPIHono<AppEnv> => {
    const runtime = createRuntime(options);
    const app = new OpenAPIHono<AppEnv>({
        defaultHook: (result, c) => {
            if (!result.success) {
                return c.json(validationError(result.error.issues), 400);
            }
            return undefined;
        },
    });

    registerSampleRoutes(app);
    registerBusinessRoutes(app, runtime);
    app.onError((error, c) => {
        if (
            error instanceof HTTPException &&
            (error.status === 400 || error.status === 415)
        ) {
            return c.json(
                errorResponse(
                    'invalid_input',
                    'Request content type must be application/json',
                ),
                400,
            );
        }
        if (error instanceof DomainError) {
            return c.json(
                errorResponse(error.code, error.message, error.details),
                statusForError(error),
            );
        }
        return c.json(
            errorResponse('internal_error', 'Internal server error'),
            500,
        );
    });
    app.notFound((c) => c.json(errorResponse('not_found', 'Not found'), 404));
    return app;
};

export const app = createApp();

export default app;
