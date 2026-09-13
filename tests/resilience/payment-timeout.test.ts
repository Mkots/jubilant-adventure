import { fixtureIds } from '@jubilant-adventure/test-data';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
    addPaymentLatency,
    cleanupPaymentProxy,
    ensurePaymentProxy,
    inspectPaymentProxy,
    removePaymentLatency,
} from './toxiproxy';

const apiUrl = (
    process.env.RESILIENCE_API_URL ?? 'http://127.0.0.1:3413'
).replace(/\/$/, '');
const controlKey = process.env.TEST_CONTROL_KEY ?? 'resilience-control';
const correlationIds = [
    'resilience-payment-timeout',
    'resilience-payment-retry',
];

interface ProductResponse {
    stock: number;
}

interface CartResponse {
    items: Array<{ productId: string; quantity: number }>;
}

interface CheckoutResponse {
    order: { id: string; status: string; idempotencyKey: string };
    replayed: boolean;
}

interface ErrorResponse {
    code: string;
    message: string;
}

const jsonRequest = async <T>(
    path: string,
    options: RequestInit = {},
): Promise<{ status: number; body: T }> => {
    const response = await fetch(`${apiUrl}${path}`, {
        ...options,
        signal: options.signal ?? AbortSignal.timeout(5_000),
        headers: {
            accept: 'application/json',
            ...(options.body ? { 'content-type': 'application/json' } : {}),
            ...options.headers,
        },
    });
    return {
        status: response.status,
        body: (await response.json()) as T,
    };
};

const login = async (): Promise<string> => {
    const response = await jsonRequest<{ token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email: 'user@example.test',
            password: 'password',
        }),
    });
    expect(response.status).toBe(200);
    return response.body.token;
};

const authenticated = (token: string, headers: HeadersInit = {}) => ({
    authorization: `Bearer ${token}`,
    ...headers,
});

describe('network-level payment timeout', () => {
    let token = '';
    let environmentAvailable = false;

    beforeAll(async () => {
        try {
            environmentAvailable = (
                await fetch(`${apiUrl}/health`, {
                    signal: AbortSignal.timeout(1_000),
                })
            ).ok;
        } catch {
            environmentAvailable = false;
        }
        if (!environmentAvailable) {
            if (process.env.RESILIENCE_REQUIRED === '1')
                throw new Error(
                    `Resilience API is unavailable at ${apiUrl}; start it with npm run env:resilience:up`,
                );
            console.warn(
                `Resilience API unavailable at ${apiUrl}; skipping integration scenario`,
            );
            return;
        }
        await jsonRequest('/__test/reset', {
            method: 'POST',
            headers: { 'X-Test-Control-Key': controlKey },
        });
        await ensurePaymentProxy();
        token = await login();
    });

    afterAll(async () => {
        if (!environmentAvailable) return;
        await cleanupPaymentProxy();
    });

    test('times out, restores state, and retries one order with the same key', async () => {
        if (!environmentAvailable) return;
        const product = await jsonRequest<ProductResponse>(
            `/products/${fixtureIds.notebook}`,
        );
        expect(product.status).toBe(200);
        const initialStock = product.body.stock;
        const cart = await jsonRequest<CartResponse>('/cart/items', {
            method: 'POST',
            headers: authenticated(token),
            body: JSON.stringify({
                productId: fixtureIds.notebook,
                quantity: 1,
            }),
        });
        expect(cart.status).toBe(200);

        const idempotencyKey = 'resilience-payment-key';
        await addPaymentLatency();
        let timedOut: { status: number; body: ErrorResponse };
        try {
            timedOut = await jsonRequest<ErrorResponse>('/orders', {
                method: 'POST',
                headers: authenticated(token, {
                    'idempotency-key': idempotencyKey,
                    'x-correlation-id': correlationIds[0],
                    'x-payment-scenario': 'success',
                }),
            });
        } catch (error) {
            console.error(
                JSON.stringify({
                    error:
                        error instanceof Error ? error.message : String(error),
                    correlationIds,
                    proxy: await inspectPaymentProxy(),
                }),
            );
            throw error;
        }
        expect(timedOut.status).toBe(504);
        expect(timedOut.body.code).toBe('payment_timeout');

        const restoredProduct = await jsonRequest<ProductResponse>(
            `/products/${fixtureIds.notebook}`,
        );
        expect(restoredProduct.body.stock).toBe(initialStock);

        await removePaymentLatency();
        const retry = await jsonRequest<CheckoutResponse>('/orders', {
            method: 'POST',
            headers: authenticated(token, {
                'idempotency-key': idempotencyKey,
                'x-correlation-id': correlationIds[1],
                'x-payment-scenario': 'success',
            }),
        });
        expect(retry.status).toBe(201);
        expect(retry.body.replayed).toBe(false);
        expect(retry.body.order.status).toBe('paid');
        expect(retry.body.order.idempotencyKey).toBe(idempotencyKey);

        const finalProduct = await jsonRequest<ProductResponse>(
            `/products/${fixtureIds.notebook}`,
        );
        expect(finalProduct.body.stock).toBe(initialStock - 1);

        const replay = await jsonRequest<CheckoutResponse>('/orders', {
            method: 'POST',
            headers: authenticated(token, {
                'idempotency-key': idempotencyKey,
                'x-correlation-id': correlationIds[1],
                'x-payment-scenario': 'success',
            }),
        });
        expect(replay.status).toBe(200);
        expect(replay.body.replayed).toBe(true);
        expect(replay.body.order.id).toBe(retry.body.order.id);
    });
});
