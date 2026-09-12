import { timingSafeEqual } from 'node:crypto';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import type {
    Actor,
    IdGenerator,
    ShopClock,
    ShopRepositories,
    ShopSeed,
    ShopServices,
} from '@jubilant-adventure/shop-domain';
import {
    createInMemoryRepositories,
    createShopServices,
    DomainError,
    FixedClock,
    resetRepositories,
    SequentialIdGenerator,
    SystemClock,
} from '@jubilant-adventure/shop-domain';
import {
    createBaselineSeed,
    createScenarioSeed,
    fixturePasswordVerifier,
    fixtureVersion,
} from '@jubilant-adventure/test-data';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createAccessToken, verifyAccessToken } from './auth/token';

export type AppEnv = {
    Variables: {
        actor: Actor;
    };
};

export type AppMode = 'development' | 'test' | 'production';

export interface ApiRuntime {
    repositories: ShopRepositories;
    services: ShopServices;
    clock: ShopClock;
    idGenerator: IdGenerator;
    tokenSecret: string;
    mode: AppMode;
    testControlKey?: string;
    reset(seed: ShopSeed): void;
}

export interface AppOptions {
    clock?: ShopClock;
    idGenerator?: IdGenerator;
    repositories?: ShopRepositories;
    tokenSecret?: string;
    mode?: AppMode;
    testControlKey?: string;
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

const CartSchema = z
    .object({
        userId: z.string().uuid(),
        items: z.array(
            z.object({
                productId: z.string().uuid(),
                quantity: z.number().int().positive(),
            }),
        ),
    })
    .openapi('Cart');

const OrderSchema = z
    .object({
        id: z.string().uuid(),
        userId: z.string().uuid(),
        idempotencyKey: z.string(),
        items: z.array(
            z.object({
                productId: z.string().uuid(),
                name: z.string(),
                unitPrice: z.object({
                    amount: z.number().int().nonnegative(),
                    currency: z.string().length(3),
                }),
                quantity: z.number().int().positive(),
                total: z.object({
                    amount: z.number().int().nonnegative(),
                    currency: z.string().length(3),
                }),
            }),
        ),
        total: z.object({
            amount: z.number().int().nonnegative(),
            currency: z.string().length(3),
        }),
        status: z.enum([
            'pending',
            'paid',
            'processing',
            'shipped',
            'cancelled',
        ]),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
    })
    .openapi('Order');

const CheckoutResponseSchema = z
    .object({ order: OrderSchema, replayed: z.boolean() })
    .openapi('CheckoutResponse');

const CartItemBodySchema = z
    .object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(100),
    })
    .openapi('CartItemRequest');

const OrderStatusBodySchema = z
    .object({
        status: z.enum([
            'pending',
            'paid',
            'processing',
            'shipped',
            'cancelled',
        ]),
    })
    .openapi('OrderStatusRequest');

const IdempotencyHeaderSchema = z
    .object({ 'idempotency-key': z.string().min(1).max(128) })
    .openapi('IdempotencyHeader');

const TestControlHeaderSchema = z
    .object({ 'x-test-control-key': z.string().min(1) })
    .openapi('TestControlHeader');

const TestSeedBodySchema = z
    .object({
        scenario: z.enum(['baseline', 'low-stock']),
        version: z.literal(fixtureVersion),
    })
    .openapi('TestSeedRequest');

const TestControlResponseSchema = z
    .object({ scenario: z.string(), version: z.string() })
    .openapi('TestControlResponse');

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
    const mode = options.mode ?? 'development';
    const clock =
        options.clock ??
        (mode === 'test'
            ? new FixedClock('2026-01-01T00:00:00.000Z')
            : new SystemClock());
    const idGenerator = options.idGenerator ?? new SequentialIdGenerator();
    const runtime: ApiRuntime = {
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
        mode,
        testControlKey:
            mode === 'test'
                ? (options.testControlKey ?? 'local-test-control')
                : undefined,
        reset: (nextSeed) => {
            resetRepositories(repositories, nextSeed);
            idGenerator.reset?.(1);
            if (clock instanceof FixedClock) {
                clock.set('2026-01-01T00:00:00.000Z');
            }
        },
    };
    runtime.reset(createBaselineSeed());
    return runtime;
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

const hasTestControlKey = (runtime: ApiRuntime, candidate: string): boolean => {
    if (!runtime.testControlKey) return false;
    const expected = Buffer.from(runtime.testControlKey);
    const actual = Buffer.from(candidate);
    return (
        actual.length === expected.length && timingSafeEqual(actual, expected)
    );
};

const testControlMiddleware =
    (runtime: ApiRuntime): MiddlewareHandler<AppEnv> =>
    async (c, next) => {
        const candidate = c.req.header('X-Test-Control-Key');
        if (!candidate || !hasTestControlKey(runtime, candidate)) {
            return c.json(
                errorResponse(
                    'unauthorized',
                    'Test control authorization is required',
                ),
                401,
            );
        }
        await next();
        return undefined;
    };

const registerTestControlRoutes = (
    app: OpenAPIHono<AppEnv>,
    runtime: ApiRuntime,
): void => {
    let controlQueue = Promise.resolve();
    const enqueue = async (operation: () => void): Promise<void> => {
        const current = controlQueue.then(operation, operation);
        controlQueue = current.then(() => undefined);
        await current;
    };

    const resetRoute = createRoute({
        method: 'post',
        path: '/__test/reset',
        middleware: testControlMiddleware(runtime),
        request: { headers: TestControlHeaderSchema },
        responses: {
            200: {
                content: {
                    'application/json': { schema: TestControlResponseSchema },
                },
                description: 'Canonical state restored',
            },
            401: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Test control key required',
            },
        },
    });

    app.openapi(resetRoute, async (c) => {
        await enqueue(() => runtime.reset(createBaselineSeed()));
        return c.json({ scenario: 'baseline', version: fixtureVersion }, 200);
    });

    const seedRoute = createRoute({
        method: 'post',
        path: '/__test/seed',
        middleware: testControlMiddleware(runtime),
        request: {
            headers: TestControlHeaderSchema,
            body: {
                content: { 'application/json': { schema: TestSeedBodySchema } },
            },
        },
        responses: {
            200: {
                content: {
                    'application/json': { schema: TestControlResponseSchema },
                },
                description: 'Named fixture loaded',
            },
            400: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Unknown fixture or malformed request',
            },
            401: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Test control key required',
            },
        },
    });

    app.openapi(seedRoute, async (c) => {
        const body = c.req.valid('json');
        await enqueue(() =>
            runtime.reset(createScenarioSeed(body.scenario, body.version)),
        );
        return c.json({ scenario: body.scenario, version: body.version }, 200);
    });
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

    const cartItemRoute = createRoute({
        method: 'post',
        path: '/cart/items',
        middleware: authMiddleware(runtime),
        request: {
            body: {
                content: { 'application/json': { schema: CartItemBodySchema } },
            },
        },
        responses: {
            200: {
                content: { 'application/json': { schema: CartSchema } },
                description: 'Updated cart',
            },
            400: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Malformed cart item',
            },
            401: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Authentication required',
            },
            404: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Product not found',
            },
            409: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Insufficient stock',
            },
        },
    });

    app.openapi(cartItemRoute, (c) => {
        const actor = c.get('actor');
        const body = c.req.valid('json');
        return c.json(
            runtime.services.carts.setItem(
                actor.userId,
                body.productId,
                body.quantity,
            ),
            200,
        );
    });

    const checkoutRoute = createRoute({
        method: 'post',
        path: '/orders',
        middleware: authMiddleware(runtime),
        request: { headers: IdempotencyHeaderSchema },
        responses: {
            201: {
                content: {
                    'application/json': { schema: CheckoutResponseSchema },
                },
                description: 'New order created',
            },
            200: {
                content: {
                    'application/json': { schema: CheckoutResponseSchema },
                },
                description: 'Existing order replayed',
            },
            400: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Malformed idempotency header',
            },
            401: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Authentication required',
            },
            409: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Cart or stock conflict',
            },
        },
    });

    app.openapi(checkoutRoute, (c) => {
        const actor = c.get('actor');
        const { 'idempotency-key': idempotencyKey } = c.req.valid('header');
        const result = runtime.services.orders.checkout(
            actor.userId,
            idempotencyKey,
        );
        return c.json(result, result.replayed ? 200 : 201);
    });

    const orderByIdRoute = createRoute({
        method: 'get',
        path: '/orders/{id}',
        middleware: authMiddleware(runtime),
        request: { params: UUIDParamsSchema },
        responses: {
            200: {
                content: { 'application/json': { schema: OrderSchema } },
                description: 'Order details',
            },
            400: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Malformed order ID',
            },
            401: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Authentication required',
            },
            403: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Order ownership denied',
            },
            404: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Order not found',
            },
        },
    });

    app.openapi(orderByIdRoute, (c) => {
        const actor = c.get('actor');
        return c.json(
            runtime.services.orders.getForActor(actor, c.req.valid('param').id),
            200,
        );
    });

    const orderStatusRoute = createRoute({
        method: 'patch',
        path: '/orders/{id}/status',
        middleware: authMiddleware(runtime),
        request: {
            params: UUIDParamsSchema,
            body: {
                content: {
                    'application/json': { schema: OrderStatusBodySchema },
                },
            },
        },
        responses: {
            200: {
                content: { 'application/json': { schema: OrderSchema } },
                description: 'Updated order status',
            },
            400: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Malformed status request',
            },
            401: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Authentication required',
            },
            403: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Admin role required',
            },
            404: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Order not found',
            },
            409: {
                content: { 'application/json': { schema: ErrorSchema } },
                description: 'Invalid order transition',
            },
        },
    });

    app.openapi(orderStatusRoute, (c) => {
        const actor = c.get('actor');
        const body = c.req.valid('json');
        return c.json(
            runtime.services.orders.transition(
                actor,
                c.req.valid('param').id,
                body.status,
            ),
            200,
        );
    });
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
    if (runtime.mode === 'test') {
        registerTestControlRoutes(app, runtime);
    }
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
