import type { AddressInfo } from 'node:net';
import type { OpenAPIHono } from '@hono/zod-openapi';
import { DomainError } from '@jubilant-adventure/shop-domain';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
    app,
    authMiddleware,
    createApp,
    createRuntime,
    statusForError,
} from '../src/app';
import { createAccessToken } from '../src/auth/token';
import { createServer } from '../src/server';

const loginAs = async (
    target: OpenAPIHono<import('../src/app').AppEnv>,
    email: string,
): Promise<string> => {
    const response = await target.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password' }),
    });
    const body = (await response.json()) as { token: string };
    return body.token;
};

describe('Hono application', () => {
    test('routes requests and parses query strings in process', async () => {
        const response = await app.request('/sample/hello?name=Codex');

        expect(response.status).toBe(406);
        expect(await response.json()).toEqual({ message: 'Hello' });
    });

    test('returns the request data for the sample route', async () => {
        const response = await app.request('/sample');

        expect(response.status).toBe(406);
        expect(await response.json()).toEqual({
            trimmedPath: 'sample',
            method: 'GET',
            queryStringObject: {},
            payload: '',
        });
    });

    test('returns JSON 404 for an unknown route', async () => {
        const response = await app.request('/missing');

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({
            code: 'not_found',
            message: 'Not found',
        });
    });

    test('logs in and queries products with schema validation', async () => {
        const login = await app.request('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'user@example.test',
                password: 'password',
            }),
        });
        expect(login.status).toBe(200);
        const loginBody = (await login.json()) as {
            token: string;
            user: { id: string; email: string; role: string };
        };
        expect(loginBody.user).toEqual({
            id: '00000000-0000-4000-8000-000000000001',
            email: 'user@example.test',
            role: 'user',
        });
        expect(loginBody.token).toEqual(expect.any(String));

        const products = await app.request(
            '/products?page=1&pageSize=2&sort=price',
        );
        expect(products.status).toBe(200);
        const productBody = (await products.json()) as { items: unknown[] };
        expect(productBody.items).toHaveLength(2);
    });

    test('rejects malformed input and wrong content type with one envelope', async () => {
        const malformed = await app.request('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: 'not json',
        });
        expect(malformed.status).toBe(400);
        expect(await malformed.json()).toMatchObject({ code: 'invalid_input' });

        const malformedId = await app.request('/products/not-a-uuid');
        expect(malformedId.status).toBe(400);
        expect(await malformedId.json()).toMatchObject({
            code: 'invalid_input',
        });

        const missingBody = await app.request('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        expect(missingBody.status).toBe(400);
        expect(await missingBody.json()).toMatchObject({
            code: 'invalid_input',
        });

        const nullBody = await app.request('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'null',
        });
        expect(nullBody.status).toBe(400);
        expect(await nullBody.json()).toMatchObject({
            code: 'invalid_input',
            fields: { request: expect.any(String) },
        });
    });

    test('does not reveal whether an email or password is wrong', async () => {
        const response = await app.request('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'user@example.test',
                password: 'wrong',
            }),
        });

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({
            code: 'invalid_credentials',
            message: 'Invalid email or password',
        });
    });

    test('returns a stable error for a missing product', async () => {
        const response = await app.request(
            '/products/00000000-0000-4000-8000-000000000999',
        );

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({
            code: 'not_found',
            message: 'Product was not found',
        });
    });

    test('does not bind a socket when an app is created', async () => {
        const isolated = createApp({ tokenSecret: 'test-secret' });
        expect((await isolated.request('/products')).status).toBe(200);
    });

    test('maps domain errors to stable HTTP statuses', () => {
        expect(statusForError(new DomainError('forbidden', 'no'))).toBe(403);
        expect(statusForError(new DomainError('conflict', 'no'))).toBe(409);
        expect(statusForError(new DomainError('invalid_input', 'no'))).toBe(
            400,
        );
    });

    test('auth middleware rejects missing and accepts valid bearer tokens', async () => {
        const runtime = createRuntime({ tokenSecret: 'test-secret' });
        const protectedApp = new Hono<import('../src/app').AppEnv>();
        protectedApp.use('*', authMiddleware(runtime));
        protectedApp.get('/private', (c) =>
            c.json({ userId: c.get('actor').userId }),
        );

        const missing = await protectedApp.request('/private');
        expect(missing.status).toBe(401);
        const token = createAccessToken(
            { userId: '00000000-0000-4000-8000-000000000001', role: 'user' },
            'test-secret',
            runtime.clock.now(),
        );
        const valid = await protectedApp.request('/private', {
            headers: { Authorization: `Bearer ${token}` },
        });
        expect(valid.status).toBe(200);
        expect(await valid.json()).toEqual({
            userId: '00000000-0000-4000-8000-000000000001',
        });
    });

    test('hides unexpected handler failures behind the error envelope', async () => {
        const isolated = createApp();
        isolated.get('/unexpected-test-error', () => {
            throw new Error('secret failure');
        });
        const response = await isolated.request('/unexpected-test-error');
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({
            code: 'internal_error',
            message: 'Internal server error',
        });
    });

    test('protects cart mutation and validates product stock', async () => {
        const isolated = createApp();
        const unauthenticated = await isolated.request('/cart/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId: '00000000-0000-4000-8000-000000000101',
                quantity: 1,
            }),
        });
        expect(unauthenticated.status).toBe(401);

        const token = await loginAs(isolated, 'user@example.test');
        const invalidQuantity = await isolated.request('/cart/items', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                productId: '00000000-0000-4000-8000-000000000101',
                quantity: 0,
            }),
        });
        expect(invalidQuantity.status).toBe(400);

        const missingProduct = await isolated.request('/cart/items', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                productId: '00000000-0000-4000-8000-000000000999',
                quantity: 1,
            }),
        });
        expect(missingProduct.status).toBe(404);

        const cart = await isolated.request('/cart/items', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                productId: '00000000-0000-4000-8000-000000000101',
                quantity: 2,
            }),
        });
        expect(cart.status).toBe(200);
        expect(await cart.json()).toMatchObject({
            userId: '00000000-0000-4000-8000-000000000001',
            items: [
                {
                    productId: '00000000-0000-4000-8000-000000000101',
                    quantity: 2,
                },
            ],
        });
    });

    test('creates and replays an order without decrementing stock twice', async () => {
        const isolated = createApp();
        const token = await loginAs(isolated, 'user@example.test');
        await isolated.request('/cart/items', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                productId: '00000000-0000-4000-8000-000000000101',
                quantity: 2,
            }),
        });

        const missingKey = await isolated.request('/orders', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        expect(missingKey.status).toBe(400);

        const first = await isolated.request('/orders', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Idempotency-Key': 'order-1',
            },
        });
        expect(first.status).toBe(201);
        const firstBody = (await first.json()) as {
            order: { id: string };
            replayed: boolean;
        };
        expect(firstBody.replayed).toBe(false);

        const replay = await isolated.request('/orders', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Idempotency-Key': 'order-1',
            },
        });
        expect(replay.status).toBe(200);
        expect(await replay.json()).toEqual({
            order: expect.objectContaining({ id: firstBody.order.id }),
            replayed: true,
        });

        const stock = await isolated.request(
            '/products/00000000-0000-4000-8000-000000000101',
        );
        expect(((await stock.json()) as { stock: number }).stock).toBe(10);

        const empty = await isolated.request('/orders', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Idempotency-Key': 'order-2',
            },
        });
        expect(empty.status).toBe(409);
    });

    test('enforces order ownership and admin-only state transitions', async () => {
        const isolated = createApp();
        const userToken = await loginAs(isolated, 'user@example.test');
        const adminToken = await loginAs(isolated, 'admin@example.test');
        await isolated.request('/cart/items', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${userToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                productId: '00000000-0000-4000-8000-000000000102',
                quantity: 1,
            }),
        });
        const checkout = await isolated.request('/orders', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${userToken}`,
                'Idempotency-Key': 'order-ownership',
            },
        });
        const orderId = ((await checkout.json()) as { order: { id: string } })
            .order.id;

        const invalidId = await isolated.request('/orders/not-a-uuid', {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        expect(invalidId.status).toBe(400);
        const missing = await isolated.request(
            '/orders/00000000-0000-4000-8000-000000000999',
            { headers: { Authorization: `Bearer ${userToken}` } },
        );
        expect(missing.status).toBe(404);

        const otherToken = createAccessToken(
            { userId: '00000000-0000-4000-8000-000000000099', role: 'user' },
            'local-development-secret',
            new Date(),
        );
        const forbidden = await isolated.request(`/orders/${orderId}`, {
            headers: { Authorization: `Bearer ${otherToken}` },
        });
        expect(forbidden.status).toBe(403);

        const own = await isolated.request(`/orders/${orderId}`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        expect(own.status).toBe(200);
        const admin = await isolated.request(`/orders/${orderId}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        expect(admin.status).toBe(200);

        const userStatus = await isolated.request(`/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${userToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'paid' }),
        });
        expect(userStatus.status).toBe(403);

        const paid = await isolated.request(`/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${adminToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'paid' }),
        });
        expect(paid.status).toBe(200);

        const illegal = await isolated.request(`/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${adminToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'pending' }),
        });
        expect(illegal.status).toBe(409);

        const missingStatus = await isolated.request(
            '/orders/00000000-0000-4000-8000-000000000999/status',
            {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: 'paid' }),
            },
        );
        expect(missingStatus.status).toBe(404);
    });

    test('keeps test controls disabled outside test mode', async () => {
        const response = await createApp().request('/__test/reset', {
            method: 'POST',
            headers: { 'X-Test-Control-Key': 'local-test-control' },
        });

        expect(response.status).toBe(404);
    });

    test('rejects test controls when no test key is configured', async () => {
        const isolated = createApp({ mode: 'test', testControlKey: '' });
        const response = await isolated.request('/__test/reset', {
            method: 'POST',
            headers: { 'X-Test-Control-Key': 'any-key' },
        });

        expect(response.status).toBe(401);
    });

    test('resets and seeds deterministic state through authorized controls', async () => {
        const defaultKeyApp = createApp({ mode: 'test' });
        const defaultReset = await defaultKeyApp.request('/__test/reset', {
            method: 'POST',
            headers: { 'X-Test-Control-Key': 'local-test-control' },
        });
        expect(defaultReset.status).toBe(200);

        const isolated = createApp({
            mode: 'test',
            testControlKey: 'control-key',
        });
        const unauthorized = await isolated.request('/__test/seed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scenario: 'low-stock', version: 'v1' }),
        });
        expect(unauthorized.status).toBe(401);
        expect(JSON.stringify(await unauthorized.json())).not.toContain(
            'low-stock',
        );

        const seedHeaders = {
            'Content-Type': 'application/json',
            'X-Test-Control-Key': 'control-key',
        };
        const firstSeed = await isolated.request('/__test/seed', {
            method: 'POST',
            headers: seedHeaders,
            body: JSON.stringify({ scenario: 'low-stock', version: 'v1' }),
        });
        expect(firstSeed.status).toBe(200);
        const firstProduct = await isolated.request(
            '/products/00000000-0000-4000-8000-000000000103',
        );
        const firstPublicState = await firstProduct.text();

        const reset = await isolated.request('/__test/reset', {
            method: 'POST',
            headers: { 'X-Test-Control-Key': 'control-key' },
        });
        expect(reset.status).toBe(200);
        const secondSeed = await isolated.request('/__test/seed', {
            method: 'POST',
            headers: seedHeaders,
            body: JSON.stringify({ scenario: 'low-stock', version: 'v1' }),
        });
        expect(secondSeed.status).toBe(200);
        const secondProduct = await isolated.request(
            '/products/00000000-0000-4000-8000-000000000103',
        );
        expect(await secondProduct.text()).toBe(firstPublicState);

        const invalidScenario = await isolated.request('/__test/seed', {
            method: 'POST',
            headers: seedHeaders,
            body: JSON.stringify({ scenario: 'unknown', version: 'v1' }),
        });
        expect(invalidScenario.status).toBe(400);

        const concurrent = await Promise.all([
            isolated.request('/__test/reset', {
                method: 'POST',
                headers: { 'X-Test-Control-Key': 'control-key' },
            }),
            isolated.request('/__test/seed', {
                method: 'POST',
                headers: seedHeaders,
                body: JSON.stringify({ scenario: 'baseline', version: 'v1' }),
            }),
            isolated.request('/__test/seed', {
                method: 'POST',
                headers: seedHeaders,
                body: JSON.stringify({ scenario: 'low-stock', version: 'v1' }),
            }),
        ]);
        expect(concurrent.map((response) => response.status)).toEqual([
            200, 200, 200,
        ]);
        const finalProduct = await isolated.request(
            '/products/00000000-0000-4000-8000-000000000103',
        );
        expect(((await finalProduct.json()) as { stock: number }).stock).toBe(
            1,
        );
    });
});

describe('Node adapter', () => {
    let server: ReturnType<typeof createServer>;
    let port: number;

    beforeEach(
        () =>
            new Promise<void>((resolve) => {
                server = createServer();
                server.listen(0, () => {
                    port = (server.address() as AddressInfo).port;
                    resolve();
                });
            }),
    );

    afterEach(
        () =>
            new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
            }),
    );

    test('starts on an ephemeral port and serves the app', async () => {
        const response = await fetch(`http://127.0.0.1:${port}/sample`);

        expect(response.status).toBe(406);
        expect(await response.json()).toMatchObject({
            trimmedPath: 'sample',
            method: 'GET',
        });
    });
});
