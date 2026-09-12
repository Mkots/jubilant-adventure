import { fixtureIds } from '@jubilant-adventure/test-data';
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
} from 'vitest';
import { ApiClient } from './client';
import { type RunningApi, startTestApi } from './server';

describe('black-box shop API', () => {
    let running: RunningApi;
    let api: ApiClient;

    beforeAll(async () => {
        running = await startTestApi();
        api = new ApiClient(running.baseUrl);
    });

    beforeEach(async () => {
        const reset = await api.reset();
        expect(reset.status).toBe(200);
    });

    afterAll(async () => {
        await running.close();
    });

    test('logs in and queries a sorted catalog', async () => {
        const login = await api.login('user@example.test', 'password');
        expect(login.status).toBe(200);
        expect(login.body.user.role).toBe('user');

        const products = await api.products('?page=1&pageSize=2&sort=price');
        expect(products.status).toBe(200);
        expect(products.body.items).toHaveLength(2);
        expect(products.body.items[0]?.name).toBe('Orbit Notebook');
    });

    test('rejects malformed requests without an undocumented server error', async () => {
        const cases = await Promise.all([
            api.request('/auth/login', {
                method: 'POST',
                json: { email: 'bad' },
            }),
            api.request('/products/not-a-uuid'),
            api.request('/products?page=0'),
            api.request('/cart/items', {
                method: 'POST',
                json: { quantity: 0 },
            }),
        ]);
        expect(cases.map(({ status }) => status)).toEqual([400, 400, 400, 400]);
        expect(cases.every(({ status }) => status < 500)).toBe(true);
        expect(cases.every(({ body }) => typeof body === 'object')).toBe(true);
    });

    test('validates cart quantities and checkout idempotency over HTTP', async () => {
        await api.login('user@example.test', 'password');
        const invalid = await api.addCartItem(fixtureIds.mug, 0);
        expect(invalid.status).toBe(400);

        const cart = await api.addCartItem(fixtureIds.mug, 2);
        expect(cart.status).toBe(200);
        expect(cart.body.items).toEqual([
            { productId: fixtureIds.mug, quantity: 2 },
        ]);

        const first = await api.checkout('black-box-order-1');
        expect(first.status).toBe(201);
        expect(first.body.replayed).toBe(false);
        const replay = await api.checkout('black-box-order-1');
        expect(replay.status).toBe(200);
        expect(replay.body.replayed).toBe(true);
        expect(replay.body.order.id).toBe(first.body.order.id);
    });

    test('enforces ownership and exact order state transitions', async () => {
        const adminLogin = await api.login('admin@example.test', 'password');
        const adminApi = api.withToken(adminLogin.body.token);
        await adminApi.addCartItem(fixtureIds.mug, 1);
        const order = await adminApi.checkout('black-box-order-2');
        expect(order.status).toBe(201);

        const userLogin = await api.login('user@example.test', 'password');
        const userApi = api.withToken(userLogin.body.token);
        expect((await userApi.getOrder(order.body.order.id)).status).toBe(403);
        expect(
            (await adminApi.updateOrderStatus(order.body.order.id, 'paid'))
                .status,
        ).toBe(200);
        expect(
            (await adminApi.updateOrderStatus(order.body.order.id, 'pending'))
                .status,
        ).toBe(409);
        expect((await adminApi.getOrder(order.body.order.id)).status).toBe(200);
    });
});
