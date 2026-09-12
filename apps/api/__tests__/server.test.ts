import type { AddressInfo } from 'node:net';
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
