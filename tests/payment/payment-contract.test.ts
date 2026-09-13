import { fixtureIds } from '@jubilant-adventure/test-data';
import { beforeAll, describe, expect, test } from 'vitest';
import { createApp } from '../../apps/api/src/app';
import { HttpPaymentGateway } from '../../apps/api/src/payments/gateway';

const paymentUrl = process.env.WIREMOCK_URL ?? 'http://127.0.0.1:8080';

const login = async (app: ReturnType<typeof createApp>): Promise<string> => {
    const response = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            email: 'user@example.test',
            password: 'password',
        }),
    });
    return ((await response.json()) as { token: string }).token;
};

const createPaymentApp = () =>
    createApp({
        mode: 'test',
        testControlKey: 'payment-control',
        paymentGateway: new HttpPaymentGateway({
            baseUrl: paymentUrl,
            timeoutMs: 800,
        }),
    });

const checkoutOn = async (
    app: ReturnType<typeof createApp>,
    token: string,
    scenario: string,
    key = `payment-${scenario}`,
) => {
    return app.request('/orders', {
        method: 'POST',
        headers: {
            authorization: `Bearer ${token}`,
            'idempotency-key': key,
            'x-correlation-id': `correlation-${scenario}`,
            'x-payment-scenario': scenario,
        },
    });
};

const checkout = async (scenario: string, key = `payment-${scenario}`) => {
    const app = createPaymentApp();
    const token = await login(app);
    await app.request('/cart/items', {
        method: 'POST',
        headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify({ productId: fixtureIds.mug, quantity: 1 }),
    });
    return checkoutOn(app, token, scenario, key);
};

describe('payment gateway contract', () => {
    let available = false;
    beforeAll(async () => {
        try {
            available = (await fetch(`${paymentUrl}/__admin/health`)).ok;
        } catch {
            available = false;
        }
        if (!available)
            console.warn(
                'WireMock unavailable; start it with npm run wiremock:up',
            );
    });

    test('authorizes success and preserves exact provider response shape', async () => {
        if (!available) return;
        const response = await checkout('success');
        expect(response.status).toBe(201);
        expect((await response.json()).order.status).toBe('paid');
    });

    test.each([
        ['decline', 409, 'payment_declined'],
        ['malformed', 502, 'payment_malformed'],
        ['server-error', 502, 'payment_unavailable'],
        ['timeout', 504, 'payment_timeout'],
    ])('maps %s to a stable business error', async (scenario, status, code) => {
        if (!available) return;
        const response = await checkout(scenario);
        expect(response.status).toBe(status);
        expect((await response.json()).code).toBe(code);
    });

    test('replays a successful checkout without a second order or provider transaction', async () => {
        if (!available) return;
        const app = createPaymentApp();
        const token = await login(app);
        await app.request('/cart/items', {
            method: 'POST',
            headers: {
                authorization: `Bearer ${token}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify({ productId: fixtureIds.mug, quantity: 1 }),
        });
        const first = await checkoutOn(
            app,
            token,
            'replay',
            'replay-contract-key',
        );
        const second = await checkoutOn(
            app,
            token,
            'replay',
            'replay-contract-key',
        );
        expect(first.status).toBe(201);
        expect(second.status).toBe(200);
        const firstBody = (await first.json()) as { order: { id: string } };
        const secondBody = (await second.json()) as { order: { id: string } };
        expect(secondBody.order.id).toBe(firstBody.order.id);
    });

    test('maps connection failures without leaking provider internals', async () => {
        const gateway = new HttpPaymentGateway({
            baseUrl: 'http://127.0.0.1:9',
            timeoutMs: 100,
        });
        await expect(
            gateway.authorize({
                orderId: fixtureIds.mug,
                amount: 1,
                currency: 'USD',
                idempotencyKey: 'connection-failure',
                correlationId: 'test',
            }),
        ).rejects.toMatchObject({ code: 'payment_unavailable' });
    });
});
