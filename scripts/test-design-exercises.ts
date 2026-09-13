import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createApp } from '../apps/api/src/app';
import type { OrderStatus } from '../packages/shop-domain/src';
import { fixtureIds } from '../packages/test-data/src';

type Expected = { id: string; expectedStatus: number };
type ResponseBody = Record<string, unknown>;

const readCases = async <T>(file: string): Promise<T[]> =>
    JSON.parse(await readFile(file, 'utf8')) as T[];

const main = async (): Promise<void> => {
    const app = createApp({
        mode: 'test',
        testControlKey: 'design-control',
        tokenSecret: 'design-secret',
    });

    const request = async (
        path: string,
        options: {
            method?: string;
            token?: string;
            control?: boolean;
            body?: unknown;
            headers?: Record<string, string>;
        } = {},
    ): Promise<{ status: number; body: ResponseBody }> => {
        const headers = new Headers(options.headers);
        if (options.token)
            headers.set('Authorization', `Bearer ${options.token}`);
        if (options.control)
            headers.set('X-Test-Control-Key', 'design-control');
        if (options.body !== undefined) {
            headers.set('Content-Type', 'application/json');
        }
        const response = await app.request(`http://design.test${path}`, {
            method: options.method ?? 'GET',
            headers,
            body:
                options.body === undefined
                    ? undefined
                    : JSON.stringify(options.body),
        });
        return {
            status: response.status,
            body: (await response.json()) as ResponseBody,
        };
    };

    const reset = async (): Promise<void> => {
        const response = await request('/__test/reset', {
            method: 'POST',
            control: true,
        });
        assert.equal(response.status, 200);
    };

    const login = async (email: string): Promise<string> => {
        const response = await request('/auth/login', {
            method: 'POST',
            body: { email, password: 'password' },
        });
        assert.equal(response.status, 200);
        return String(response.body.token);
    };

    const assertCases = (
        cases: Expected[],
        actual: Map<string, number>,
    ): void => {
        const ids = new Set<string>();
        for (const item of cases) {
            assert(!ids.has(item.id), `duplicate case ID: ${item.id}`);
            ids.add(item.id);
            assert.equal(actual.get(item.id), item.expectedStatus, item.id);
        }
        assert.equal(actual.size, cases.length, 'an executable row is missing');
    };

    const runBoundaryCases = async (): Promise<Map<string, number>> => {
        const cases = await readCases<
            Expected & { kind: string; value: number }
        >('training/test-design/boundary-values/reference.json');
        const actual = new Map<string, number>();
        for (const item of cases) {
            await reset();
            if (item.kind === 'page' || item.kind === 'pageSize') {
                const query =
                    item.kind === 'page'
                        ? `page=${item.value}`
                        : `pageSize=${item.value}`;
                actual.set(
                    item.id,
                    (await request(`/products?${query}`)).status,
                );
            } else if (item.kind === 'quantity') {
                const token = await login('user@example.test');
                actual.set(
                    item.id,
                    (
                        await request('/cart/items', {
                            method: 'POST',
                            token,
                            body: {
                                productId: fixtureIds.mug,
                                quantity: item.value,
                            },
                        })
                    ).status,
                );
            } else {
                const token = await login('user@example.test');
                actual.set(
                    item.id,
                    (
                        await request('/orders', {
                            method: 'POST',
                            token,
                            headers: {
                                'Idempotency-Key': 'x'.repeat(item.value),
                            },
                        })
                    ).status,
                );
            }
        }
        assertCases(cases, actual);
        return actual;
    };

    const runEquivalenceCases = async (): Promise<Map<string, number>> => {
        const cases = await readCases<
            Expected & { kind: string; variant: string }
        >('training/test-design/equivalence-classes/reference.json');
        const actual = new Map<string, number>();
        for (const item of cases) {
            await reset();
            if (item.kind === 'credentials') {
                actual.set(
                    item.id,
                    (
                        await request('/auth/login', {
                            method: 'POST',
                            body: {
                                email: 'user@example.test',
                                password:
                                    item.variant === 'valid'
                                        ? 'password'
                                        : 'wrong',
                            },
                        })
                    ).status,
                );
            } else if (item.kind === 'role') {
                actual.set(
                    item.id,
                    (
                        await request('/auth/login', {
                            method: 'POST',
                            body: {
                                email: `${item.variant}@example.test`,
                                password: 'password',
                            },
                        })
                    ).status,
                );
            } else if (item.kind === 'product') {
                const id =
                    item.variant === 'existing'
                        ? fixtureIds.mug
                        : '00000000-0000-4000-8000-000000000999';
                actual.set(item.id, (await request(`/products/${id}`)).status);
            } else if (item.kind === 'stock') {
                const token = await login('user@example.test');
                actual.set(
                    item.id,
                    (
                        await request('/cart/items', {
                            method: 'POST',
                            token,
                            body: {
                                productId: fixtureIds.keyboard,
                                quantity: item.variant === 'enough' ? 1 : 4,
                            },
                        })
                    ).status,
                );
            } else {
                const token = await login('user@example.test');
                actual.set(
                    item.id,
                    (
                        await request('/cart/items', {
                            method: 'POST',
                            token,
                            body: { quantity: 1 },
                        })
                    ).status,
                );
            }
        }
        assertCases(cases, actual);
        return actual;
    };

    const runDecisionTable = async (): Promise<Map<string, number>> => {
        const cases = await readCases<
            Expected & {
                authenticated: boolean;
                cartPresent: boolean;
                stockAvailable: boolean;
                replayed: boolean;
            }
        >('training/test-design/checkout-decision-table/reference.json');
        const actual = new Map<string, number>();
        for (const item of cases) {
            await reset();
            const token = item.authenticated
                ? await login('user@example.test')
                : undefined;
            if (token && item.cartPresent) {
                await request('/cart/items', {
                    method: 'POST',
                    token,
                    body: {
                        productId: fixtureIds.mug,
                        quantity: item.stockAvailable ? 1 : 100,
                    },
                });
            }
            const headers = { 'Idempotency-Key': `decision-${item.id}` };
            if (token && item.replayed) {
                await request('/orders', { method: 'POST', token, headers });
            }
            actual.set(
                item.id,
                (await request('/orders', { method: 'POST', token, headers }))
                    .status,
            );
        }
        assertCases(cases, actual);
        return actual;
    };

    const transitionPath: Record<OrderStatus, OrderStatus[]> = {
        pending: [],
        paid: ['paid'],
        processing: ['paid', 'processing'],
        shipped: ['paid', 'processing', 'shipped'],
        cancelled: ['cancelled'],
    };

    const runTransitionCases = async (): Promise<Map<string, number>> => {
        const cases = await readCases<
            Expected & { from: OrderStatus; to: OrderStatus }
        >('training/test-design/order-state-transitions/reference.json');
        const actual = new Map<string, number>();
        for (const item of cases) {
            await reset();
            const token = await login('admin@example.test');
            await request('/cart/items', {
                method: 'POST',
                token,
                body: { productId: fixtureIds.mug, quantity: 1 },
            });
            const created = await request('/orders', {
                method: 'POST',
                token,
                headers: { 'Idempotency-Key': `transition-${item.id}` },
            });
            assert.equal(created.status, 201, `setup for ${item.id}`);
            const orderId = String((created.body.order as ResponseBody).id);
            for (const status of transitionPath[item.from]) {
                const walked = await request(`/orders/${orderId}/status`, {
                    method: 'PATCH',
                    token,
                    body: { status },
                });
                assert.equal(
                    walked.status,
                    200,
                    `walk ${item.id} through ${status}`,
                );
            }
            actual.set(
                item.id,
                (
                    await request(`/orders/${orderId}/status`, {
                        method: 'PATCH',
                        token,
                        body: { status: item.to },
                    })
                ).status,
            );
        }
        assertCases(cases, actual);
        return actual;
    };

    const results = {
        boundary: await runBoundaryCases(),
        equivalence: await runEquivalenceCases(),
        decisionTable: await runDecisionTable(),
        transitions: await runTransitionCases(),
    };
    await mkdir('artifacts/test-design', { recursive: true });
    await writeFile(
        'artifacts/test-design/results.json',
        `${JSON.stringify(Object.fromEntries(Object.entries(results).map(([key, value]) => [key, Object.fromEntries(value)])), null, 2)}\n`,
    );
    process.stdout.write(
        `Validated ${Object.values(results).reduce((sum, map) => sum + map.size, 0)} test-design cases.\n`,
    );
};

void main().catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
});
