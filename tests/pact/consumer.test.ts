import path from 'node:path';
import { MatchersV3, PactV4 } from '@pact-foundation/pact';
import { describe, expect, test } from 'vitest';
import { createApiClient } from '../../packages/api-client/src/client';

const pactDir = path.resolve(process.cwd(), 'pacts');
const userId = '00000000-0000-4000-8000-000000000001';
const productId = '00000000-0000-4000-8000-000000000101';
const orderId = '00000000-0000-4000-8000-000000000701';
const authHeaders = {
    authorization: 'Bearer pact-test-token',
    accept: 'application/json',
};
const adminAuthHeaders = {
    authorization: 'Bearer pact-admin-test-token',
    accept: 'application/json',
};
const isoDateTime = () =>
    MatchersV3.regex(
        '^\\d{4}-[01]\\d-[0-3]\\dT[0-2]\\d:[0-5]\\d:[0-5]\\d(?:\\.\\d{3})?(?:[+-][0-2]\\d:[0-5]\\d|Z)$',
        '2026-01-01T00:00:00.000Z',
    );

const pact = () =>
    new PactV4({
        consumer: 'ReactShopClient',
        provider: 'HonoShopApi',
        dir: pactDir,
        spec: 4,
    });

describe('React client consumer contract', () => {
    test('login', async () => {
        await pact()
            .addInteraction()
            .given('baseline users exist')
            .uponReceiving('a valid login request')
            .withRequest('POST', '/auth/login', (request) =>
                request
                    .headers({ 'content-type': 'application/json' })
                    .jsonBody({
                        email: 'user@example.test',
                        password: 'password',
                    }),
            )
            .willRespondWith(200, (response) =>
                response
                    .headers({ 'content-type': 'application/json' })
                    .jsonBody({
                        token: MatchersV3.like('provider-token'),
                        expiresIn: MatchersV3.integer(900),
                        user: {
                            id: MatchersV3.like(userId),
                            email: MatchersV3.like('user@example.test'),
                            role: MatchersV3.regex('user|admin', 'user'),
                        },
                    }),
            )
            .executeTest(async (server) => {
                const response = await createApiClient({
                    baseUrl: server.url,
                }).request('/auth/login', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        email: 'user@example.test',
                        password: 'password',
                    }),
                });
                expect(response.status).toBe(200);
            });
    });

    test('product result', async () => {
        await pact()
            .addInteraction()
            .given('active products exist')
            .uponReceiving('a request for the first product page')
            .withRequest('GET', '/products', (request) =>
                request
                    .query({ page: '1', pageSize: '20' })
                    .headers({ accept: 'application/json' }),
            )
            .willRespondWith(200, (response) =>
                response
                    .headers({ 'content-type': 'application/json' })
                    .jsonBody({
                        items: MatchersV3.eachLike({
                            id: MatchersV3.like(productId),
                            name: MatchersV3.like('Comet Mug'),
                            description: MatchersV3.like('A product'),
                            category: MatchersV3.like('home'),
                            price: {
                                amount: MatchersV3.integer(1299),
                                currency: MatchersV3.like('USD'),
                            },
                            stock: MatchersV3.integer(12),
                            active: MatchersV3.like(true),
                        }),
                        total: MatchersV3.integer(1),
                        page: MatchersV3.integer(1),
                        pageSize: MatchersV3.integer(20),
                        totalPages: MatchersV3.integer(1),
                    }),
            )
            .executeTest(async (server) => {
                const response = await createApiClient({
                    baseUrl: server.url,
                }).request('/products?page=1&pageSize=20');
                expect(response.status).toBe(200);
            });
    });

    test('checkout success and business error', async () => {
        const provider = pact();
        await provider
            .addInteraction()
            .given('a user has a non-empty cart')
            .uponReceiving('a checkout request')
            .withRequest('POST', '/orders', (request) =>
                request.headers({
                    ...authHeaders,
                    'idempotency-key': 'pact-checkout',
                }),
            )
            .willRespondWith(201, (response) =>
                response
                    .headers({ 'content-type': 'application/json' })
                    .jsonBody({
                        order: {
                            id: MatchersV3.like(orderId),
                            userId: MatchersV3.like(userId),
                            idempotencyKey: MatchersV3.like('pact-checkout'),
                            items: MatchersV3.eachLike({
                                productId: MatchersV3.like(productId),
                                name: MatchersV3.like('Comet Mug'),
                                unitPrice: {
                                    amount: MatchersV3.integer(1299),
                                    currency: MatchersV3.like('USD'),
                                },
                                quantity: MatchersV3.integer(1),
                                total: {
                                    amount: MatchersV3.integer(1299),
                                    currency: MatchersV3.like('USD'),
                                },
                            }),
                            total: {
                                amount: MatchersV3.integer(1299),
                                currency: MatchersV3.like('USD'),
                            },
                            status: MatchersV3.regex('pending|paid', 'pending'),
                            createdAt: isoDateTime(),
                            updatedAt: isoDateTime(),
                        },
                        replayed: MatchersV3.like(false),
                    }),
            )
            .executeTest(async (server) => {
                const response = await createApiClient({
                    baseUrl: server.url,
                    token: 'pact-test-token',
                }).request('/orders', {
                    method: 'POST',
                    headers: { 'idempotency-key': 'pact-checkout' },
                });
                expect(response.status).toBe(201);
            });

        await pact()
            .addInteraction()
            .given('a user has an empty cart')
            .uponReceiving('a checkout request with no cart items')
            .withRequest('POST', '/orders', (request) =>
                request.headers({
                    ...authHeaders,
                    'idempotency-key': 'pact-empty-cart',
                }),
            )
            .willRespondWith(409, (response) =>
                response
                    .headers({ 'content-type': 'application/json' })
                    .jsonBody({
                        code: MatchersV3.like('empty_cart'),
                        message: MatchersV3.like('The cart is empty'),
                    }),
            )
            .executeTest(async (server) => {
                const response = await createApiClient({
                    baseUrl: server.url,
                    token: 'pact-test-token',
                }).request('/orders', {
                    method: 'POST',
                    headers: { 'idempotency-key': 'pact-empty-cart' },
                });
                expect(response.status).toBe(409);
            });
    });

    test('order transition', async () => {
        await pact()
            .addInteraction()
            .given('a pending order exists')
            .uponReceiving('an admin payment status transition')
            .withRequest('PATCH', `/orders/${orderId}/status`, (request) =>
                request
                    .headers({
                        ...adminAuthHeaders,
                        'content-type': 'application/json',
                    })
                    .jsonBody({ status: 'paid' }),
            )
            .willRespondWith(200, (response) =>
                response
                    .headers({ 'content-type': 'application/json' })
                    .jsonBody({
                        id: MatchersV3.like(orderId),
                        userId: MatchersV3.like(userId),
                        idempotencyKey: MatchersV3.like('seed-order'),
                        items: MatchersV3.eachLike({
                            productId: MatchersV3.like(productId),
                            name: MatchersV3.like('Comet Mug'),
                            unitPrice: {
                                amount: MatchersV3.integer(1299),
                                currency: MatchersV3.like('USD'),
                            },
                            quantity: MatchersV3.integer(1),
                            total: {
                                amount: MatchersV3.integer(1299),
                                currency: MatchersV3.like('USD'),
                            },
                        }),
                        total: {
                            amount: MatchersV3.integer(1299),
                            currency: MatchersV3.like('USD'),
                        },
                        status: MatchersV3.like('paid'),
                        createdAt: isoDateTime(),
                        updatedAt: isoDateTime(),
                    }),
            )
            .executeTest(async (server) => {
                const response = await createApiClient({
                    baseUrl: server.url,
                    token: 'pact-admin-test-token',
                }).request(`/orders/${orderId}/status`, {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ status: 'paid' }),
                });
                expect(response.status).toBe(200);
            });
    });
});
