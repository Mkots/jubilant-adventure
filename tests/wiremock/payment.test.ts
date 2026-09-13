import { beforeAll, describe, expect, test } from 'vitest';

const baseUrl = process.env.WIREMOCK_URL ?? 'http://127.0.0.1:8080';

const isAvailable = async (): Promise<boolean> => {
    try {
        return (await fetch(`${baseUrl}/__admin/health`)).ok;
    } catch {
        return false;
    }
};

const payment = async (scenario: string, key = `wiremock-${scenario}`) =>
    fetch(`${baseUrl}/payments/authorize`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-payment-scenario': scenario,
            'idempotency-key': key,
            'x-correlation-id': `test-${scenario}`,
        },
        body: JSON.stringify({
            orderId: '00000000-0000-4000-8000-000000000001',
            amount: 1299,
            currency: 'USD',
        }),
    });

describe('WireMock payment service', () => {
    let available = false;

    beforeAll(async () => {
        available = await isAvailable();
        if (!available) {
            console.warn(
                'WireMock unavailable; start it with npm run wiremock:up',
            );
        }
    });

    test('covers all explicit provider scenarios', async () => {
        if (!available) return;
        const statuses = await Promise.all(
            ['success', 'decline', 'malformed', 'server-error', 'replay'].map(
                async (scenario) => (await payment(scenario)).status,
            ),
        );
        expect(statuses).toEqual([200, 402, 200, 500, 200]);
        const success = await payment('success');
        expect(await success.json()).toEqual({
            providerTransactionId: 'txn-success-001',
            status: 'authorized',
        });
    });

    test('replay returns the same provider transaction for the same key', async () => {
        if (!available) return;
        const first = await payment('replay', 'same-payment-key');
        const second = await payment('replay', 'same-payment-key');
        const firstBody = (await first.json()) as {
            providerTransactionId: string;
        };
        const secondBody = (await second.json()) as {
            providerTransactionId: string;
        };
        expect(firstBody.providerTransactionId).toBe('same-payment-key');
        expect(secondBody).toEqual(firstBody);
    });

    test('records the exact outbound method, path, and headers', async () => {
        if (!available) return;
        await fetch(`${baseUrl}/__admin/requests/reset`, { method: 'POST' });
        await payment('success', 'inspection-key');
        const response = await fetch(`${baseUrl}/__admin/requests`);
        const body = (await response.json()) as {
            requests: Array<{
                request: {
                    method: string;
                    url: string;
                    headers: Record<string, string>;
                };
            }>;
        };
        expect(body.requests[0]?.request).toMatchObject({
            method: 'POST',
            url: '/payments/authorize',
        });
        const idempotencyHeader = Object.entries(
            body.requests[0]?.request.headers ?? {},
        ).find(([name]) => name.toLowerCase() === 'idempotency-key');
        expect(idempotencyHeader?.[1]).toBe('inspection-key');
    });
});
