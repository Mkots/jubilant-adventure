import { describe, expect, test } from 'vitest';
import {
    createInMemoryRepositories,
    createShopServices,
    DomainError,
    FixedClock,
    SequentialIdGenerator,
} from '../src';

const fixtureIds = {
    user: '00000000-0000-4000-8000-000000000001',
    admin: '00000000-0000-4000-8000-000000000002',
    mug: '00000000-0000-4000-8000-000000000101',
    notebook: '00000000-0000-4000-8000-000000000102',
    keyboard: '00000000-0000-4000-8000-000000000103',
} as const;

const createUsers = () => [
    {
        id: fixtureIds.user,
        email: 'user@example.test',
        passwordHash: 'fixture:password',
        role: 'user' as const,
    },
    {
        id: fixtureIds.admin,
        email: 'admin@example.test',
        passwordHash: 'fixture:password',
        role: 'admin' as const,
    },
];

const createProducts = () => [
    {
        id: fixtureIds.mug,
        name: 'Comet Mug',
        description: 'A durable ceramic mug.',
        category: 'home',
        price: { amount: 1299, currency: 'USD' },
        stock: 12,
        active: true,
    },
    {
        id: fixtureIds.notebook,
        name: 'Orbit Notebook',
        description: 'A lined notebook.',
        category: 'stationery',
        price: { amount: 899, currency: 'USD' },
        stock: 20,
        active: true,
    },
    {
        id: fixtureIds.keyboard,
        name: 'Signal Keyboard',
        description: 'A compact keyboard.',
        category: 'hardware',
        price: { amount: 7999, currency: 'USD' },
        stock: 3,
        active: true,
    },
];

const setup = () => {
    const repositories = createInMemoryRepositories();
    repositories.users.reset(createUsers());
    repositories.products.reset(createProducts());
    const clock = new FixedClock('2026-01-01T00:00:00.000Z');
    const ids = new SequentialIdGenerator();
    const services = createShopServices(repositories, clock, ids, {
        verify: (password, passwordHash) =>
            passwordHash === `fixture:${password}`,
    });
    return { repositories, services, clock, ids };
};

describe('shop domain', () => {
    test('verifies credentials without exposing password hashes', () => {
        const { services } = setup();
        expect(
            services.auth.verifyCredentials('USER@EXAMPLE.TEST', 'password'),
        ).toEqual({
            id: fixtureIds.user,
            email: 'user@example.test',
            role: 'user',
        });
        expect(() =>
            services.auth.verifyCredentials('user@example.test', 'wrong'),
        ).toThrow(DomainError);
    });

    test('returns stable product pagination and sorting', () => {
        const { services } = setup();
        const page = services.products.list({
            page: 1,
            pageSize: 2,
            sort: 'price',
        });
        expect(page.items.map((product) => product.id)).toEqual([
            fixtureIds.notebook,
            fixtureIds.mug,
        ]);
        expect(page.total).toBe(3);
        expect(page.totalPages).toBe(2);
    });

    test('returns defensive repository values', () => {
        const { repositories } = setup();
        const product = repositories.products.getById(fixtureIds.mug);
        if (!product) throw new Error('fixture product missing');
        product.name = 'mutated';
        expect(repositories.products.getById(fixtureIds.mug)?.name).toBe(
            'Comet Mug',
        );
    });

    test('enforces stock during cart mutation and checkout', () => {
        const { services, repositories } = setup();
        expect(() =>
            services.carts.setItem(fixtureIds.user, fixtureIds.keyboard, 4),
        ).toThrow(DomainError);
        services.carts.setItem(fixtureIds.user, fixtureIds.keyboard, 2);
        const first = services.orders.checkout(fixtureIds.user, 'checkout-1');
        const second = services.orders.checkout(fixtureIds.user, 'checkout-1');
        expect(second).toEqual({ order: first.order, replayed: true });
        expect(repositories.products.getById(fixtureIds.keyboard)?.stock).toBe(
            1,
        );
    });

    test('rejects empty carts and cross-user order access', () => {
        const { services } = setup();
        expect(() =>
            services.orders.checkout(fixtureIds.user, 'empty'),
        ).toThrow(DomainError);
        services.carts.setItem(fixtureIds.user, fixtureIds.mug, 1);
        const { order } = services.orders.checkout(
            fixtureIds.user,
            'checkout-2',
        );
        expect(() =>
            services.orders.getForActor(
                { userId: fixtureIds.admin, role: 'user' },
                order.id,
            ),
        ).toThrow(DomainError);
    });

    test('enforces every order state transition', () => {
        const { services } = setup();
        services.carts.setItem(fixtureIds.user, fixtureIds.mug, 1);
        const { order } = services.orders.checkout(
            fixtureIds.user,
            'checkout-3',
        );
        expect(
            services.orders.transition(
                { userId: fixtureIds.admin, role: 'admin' },
                order.id,
                'paid',
            ).status,
        ).toBe('paid');
        expect(
            services.orders.transition(
                { userId: fixtureIds.admin, role: 'admin' },
                order.id,
                'processing',
            ).status,
        ).toBe('processing');
        expect(
            services.orders.transition(
                { userId: fixtureIds.admin, role: 'admin' },
                order.id,
                'shipped',
            ).status,
        ).toBe('shipped');
        expect(() =>
            services.orders.transition(
                { userId: fixtureIds.admin, role: 'admin' },
                order.id,
                'cancelled',
            ),
        ).toThrow(DomainError);
    });

    test('rejects non-admin status changes', () => {
        const { services } = setup();
        services.carts.setItem(fixtureIds.user, fixtureIds.mug, 1);
        const { order } = services.orders.checkout(
            fixtureIds.user,
            'checkout-4',
        );
        expect(() =>
            services.orders.transition(
                { userId: fixtureIds.user, role: 'user' },
                order.id,
                'paid',
            ),
        ).toThrow(DomainError);
    });
});
