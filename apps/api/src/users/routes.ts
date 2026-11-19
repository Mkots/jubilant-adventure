import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import type { AccountService } from '@jubilant-adventure/shop-domain';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../app';
import { errorContent } from '../http/errors';

const MoneySchema = z.object({
    amount: z.number().int().nonnegative(),
    currency: z.string().length(3),
});

const nullableAmount = z.number().int().positive().max(100_000_000).nullable();

const LimitsSchema = z
    .object({
        dailyDeposit: nullableAmount,
        weeklyDeposit: nullableAmount,
        monthlyDeposit: nullableAmount,
        sessionMinutes: z.number().int().min(1).max(1440).nullable(),
    })
    .openapi('AccountLimits');

const BonusSchema = z
    .object({
        id: z.string().uuid(),
        code: z.string(),
        amount: MoneySchema,
        status: z.enum(['pending', 'active']),
        grantedAt: z.string().datetime(),
        activatedAt: z.string().datetime().nullable(),
    })
    .openapi('Bonus');

const UserAccountSchema = z
    .object({
        id: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(['user', 'admin']),
        status: z.enum(['pending_verification', 'verifying', 'verified']),
        profile: z.object({
            firstName: z.string().nullable(),
            lastName: z.string().nullable(),
            dateOfBirth: z.string().nullable(),
            country: z.string().nullable(),
        }),
        currency: z.string().length(3),
        balance: MoneySchema,
        bonusBalance: MoneySchema,
        bonuses: z.array(BonusSchema),
        limits: LimitsSchema,
        createdAt: z.string().datetime(),
        verifiedAt: z.string().datetime().nullable(),
    })
    .openapi('UserAccount');

const RegistrationBodySchema = z
    .object({
        email: z.string().trim().email().max(320),
        password: z.string().min(8).max(128),
        firstName: z.string().trim().min(1).max(100).optional(),
        lastName: z.string().trim().min(1).max(100).optional(),
        dateOfBirth: z.iso.date().optional(),
        country: z
            .string()
            .regex(/^[A-Z]{2}$/, 'Must be an ISO 3166-1 alpha-2 code')
            .optional(),
        currency: z
            .string()
            .regex(/^[A-Z]{3}$/, 'Must be an ISO 4217 code')
            .optional(),
    })
    .openapi('RegistrationRequest');

const VerificationBodySchema = z
    .object({ code: z.string().min(1).max(16).optional() })
    .openapi('VerificationRequest');

const BalanceBodySchema = z
    .object({ amount: z.number().int().min(0).max(100_000_000) })
    .openapi('BalanceRequest');

const BonusBodySchema = z
    .object({
        code: z.string().trim().min(1).max(64),
        amount: z.number().int().min(1).max(100_000_000),
    })
    .openapi('BonusRequest');

const LimitsBodySchema = z
    .object({
        dailyDeposit: nullableAmount.default(null),
        weeklyDeposit: nullableAmount.default(null),
        monthlyDeposit: nullableAmount.default(null),
        sessionMinutes: z
            .number()
            .int()
            .min(1)
            .max(1440)
            .nullable()
            .default(null),
    })
    .openapi('LimitsRequest');

const UserIdParamsSchema = z.object({ id: z.string().uuid() });

const accountContent = (description: string) => ({
    content: { 'application/json': { schema: UserAccountSchema } },
    description,
});

const jsonBody = <T extends z.ZodType>(schema: T) => ({
    content: { 'application/json': { schema } },
    required: true,
});

export interface UserRouteDependencies {
    accounts: AccountService;
    requireAuth: MiddlewareHandler<AppEnv>;
}

export const registerUserRoutes = (
    app: OpenAPIHono<AppEnv>,
    { accounts, requireAuth }: UserRouteDependencies,
): void => {
    const registerRoute = createRoute({
        method: 'post',
        path: '/users',
        tags: ['users'],
        summary: 'Register a user',
        request: { body: jsonBody(RegistrationBodySchema) },
        responses: {
            201: accountContent('User registered and waiting for verification'),
            400: errorContent('Malformed registration request'),
            409: errorContent('Email already registered'),
        },
    });

    app.openapi(registerRoute, async (c) =>
        c.json(await accounts.register(c.req.valid('json')), 201),
    );

    const meRoute = createRoute({
        method: 'get',
        path: '/users/me',
        tags: ['users'],
        summary: 'Get the authenticated user',
        security: [{ bearerAuth: [] }],
        middleware: requireAuth,
        responses: {
            200: accountContent('Authenticated user account'),
            401: errorContent('Authentication required'),
            404: errorContent('User not found'),
        },
    });

    app.openapi(meRoute, async (c) => {
        const actor = c.get('actor');
        return c.json(await accounts.get(actor, actor.userId), 200);
    });

    const userByIdRoute = createRoute({
        method: 'get',
        path: '/users/{id}',
        tags: ['users'],
        summary: 'Get a user (self or admin)',
        security: [{ bearerAuth: [] }],
        middleware: requireAuth,
        request: { params: UserIdParamsSchema },
        responses: {
            200: accountContent('User account'),
            400: errorContent('Malformed user ID'),
            401: errorContent('Authentication required'),
            403: errorContent('Access to another user denied'),
            404: errorContent('User not found'),
        },
    });

    app.openapi(userByIdRoute, async (c) =>
        c.json(
            await accounts.get(c.get('actor'), c.req.valid('param').id),
            200,
        ),
    );

    const verificationRoute = createRoute({
        method: 'post',
        path: '/users/{id}/verification',
        tags: ['users'],
        summary: 'Start verification',
        description:
            'A user confirms with the emailed code; an admin may omit it. ' +
            'Verification completes asynchronously: poll GET /users/{id} ' +
            'until status is "verified".',
        security: [{ bearerAuth: [] }],
        middleware: requireAuth,
        request: {
            params: UserIdParamsSchema,
            body: {
                content: {
                    'application/json': { schema: VerificationBodySchema },
                },
            },
        },
        responses: {
            202: accountContent('Verification started'),
            200: accountContent('User is already verified'),
            400: errorContent('Malformed request or invalid code'),
            401: errorContent('Authentication required'),
            403: errorContent('Access to another user denied'),
            404: errorContent('User not found'),
        },
    });

    app.openapi(verificationRoute, async (c) => {
        const account = await accounts.startVerification(
            c.get('actor'),
            c.req.valid('param').id,
            c.req.valid('json').code,
        );
        return account.status === 'verified'
            ? c.json(account, 200)
            : c.json(account, 202);
    });

    const balanceRoute = createRoute({
        method: 'put',
        path: '/users/{id}/balance',
        tags: ['users'],
        summary: 'Set the real-money balance (admin)',
        security: [{ bearerAuth: [] }],
        middleware: requireAuth,
        request: {
            params: UserIdParamsSchema,
            body: jsonBody(BalanceBodySchema),
        },
        responses: {
            200: accountContent('Updated user account'),
            400: errorContent('Malformed balance request'),
            401: errorContent('Authentication required'),
            403: errorContent('Admin role required'),
            404: errorContent('User not found'),
            409: errorContent('User is not verified'),
        },
    });

    app.openapi(balanceRoute, async (c) =>
        c.json(
            await accounts.setBalance(
                c.get('actor'),
                c.req.valid('param').id,
                c.req.valid('json').amount,
            ),
            200,
        ),
    );

    const bonusRoute = createRoute({
        method: 'post',
        path: '/users/{id}/bonuses',
        tags: ['users'],
        summary: 'Grant a bonus (admin)',
        description:
            'The bonus is created as "pending" and activated asynchronously; ' +
            'once active its amount is added to bonusBalance.',
        security: [{ bearerAuth: [] }],
        middleware: requireAuth,
        request: {
            params: UserIdParamsSchema,
            body: jsonBody(BonusBodySchema),
        },
        responses: {
            202: {
                content: { 'application/json': { schema: BonusSchema } },
                description: 'Bonus granted and pending activation',
            },
            400: errorContent('Malformed bonus request'),
            401: errorContent('Authentication required'),
            403: errorContent('Admin role required'),
            404: errorContent('User not found'),
            409: errorContent('User is not verified'),
        },
    });

    app.openapi(bonusRoute, async (c) =>
        c.json(
            await accounts.grantBonus(
                c.get('actor'),
                c.req.valid('param').id,
                c.req.valid('json'),
            ),
            202,
        ),
    );

    const limitsRoute = createRoute({
        method: 'put',
        path: '/users/{id}/limits',
        tags: ['users'],
        summary: 'Replace responsible-gaming limits (self or admin)',
        description:
            'Omitted or null fields remove that limit. Deposit amounts are ' +
            'minor units of the account currency.',
        security: [{ bearerAuth: [] }],
        middleware: requireAuth,
        request: {
            params: UserIdParamsSchema,
            body: jsonBody(LimitsBodySchema),
        },
        responses: {
            200: accountContent('Updated user account'),
            400: errorContent('Malformed or inconsistent limits'),
            401: errorContent('Authentication required'),
            403: errorContent('Access to another user denied'),
            404: errorContent('User not found'),
        },
    });

    app.openapi(limitsRoute, async (c) =>
        c.json(
            await accounts.setLimits(
                c.get('actor'),
                c.req.valid('param').id,
                c.req.valid('json'),
            ),
            200,
        ),
    );
};
