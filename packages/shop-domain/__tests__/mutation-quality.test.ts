import { describe, expect, test } from 'vitest';
import {
    createInMemoryRepositories,
    createShopServices,
    DomainError,
    FixedClock,
    SequentialIdGenerator,
} from '../src';

const ids = {
    user: '00000000-0000-4000-8000-000000000001',
    admin: '00000000-0000-4000-8000-000000000002',
    mug: '00000000-0000-4000-8000-000000000101',
    keyboard: '00000000-0000-4000-8000-000000000103',
};

const setup = () => {
    const repositories = createInMemoryRepositories();
    repositories.users.reset([
        {
            id: ids.user,
            email: 'user@example.test',
            passwordHash: 'fixture:password',
            role: 'user',
        },
        {
            id: ids.admin,
            email: 'admin@example.test',
            passwordHash: 'fixture:password',
            role: 'admin',
        },
    ]);
    repositories.products.reset([
        {
            id: ids.mug,
            name: 'Comet Mug',
            description: 'Durable mug',
            category: 'home',
            price: { amount: 1299, currency: 'USD' },
            stock: 12,
            active: true,
        },
        {
            id: ids.keyboard,
            name: 'Signal Keyboard',
            description: 'Quiet keyboard',
            category: 'hardware',
            price: { amount: 7999, currency: 'USD' },
            stock: 3,
            active: true,
        },
    ]);
    const services = createShopServices(
        repositories,
        new FixedClock('2026-01-01T00:00:00.000Z'),
        new SequentialIdGenerator(),
        { verify: (password, hash) => hash === `fixture:${password}` },
    );
    return { repositories, services };
};

describe('mutation quality boundaries', () => {
    test('distinguishes invalid pagination, filters, and descending sorting', () => {
        const { services } = setup();
        expect(() => services.products.list({ page: 0, pageSize: 1 })).toThrow(
            DomainError,
        );
        expect(() =>
            services.products.list({ page: 1, pageSize: 101 }),
        ).toThrow(DomainError);
        expect(
            services.products.list({ page: 1, pageSize: 1, search: 'keyboard' })
                .items[0]?.id,
        ).toBe(ids.keyboard);
        expect(
            services.products.list({
                page: 1,
                pageSize: 2,
                sort: 'price',
                direction: 'desc',
            }).items[0]?.id,
        ).toBe(ids.keyboard);
    });

    test('preserves exact stock and replaces an existing cart line', () => {
        const { services } = setup();
        expect(services.carts.setItem(ids.user, ids.keyboard, 3).items).toEqual(
            [{ productId: ids.keyboard, quantity: 3 }],
        );
        expect(services.carts.setItem(ids.user, ids.keyboard, 1).items).toEqual(
            [{ productId: ids.keyboard, quantity: 1 }],
        );
        expect(() => services.carts.setItem(ids.user, ids.keyboard, 0)).toThrow(
            DomainError,
        );
        expect(() => services.carts.setItem(ids.user, ids.keyboard, 4)).toThrow(
            DomainError,
        );
    });

    test('rejects whitespace keys and preserves checkout totals and cart clearing', () => {
        const { services, repositories } = setup();
        expect(() => services.orders.checkout(ids.user, '   ')).toThrow(
            DomainError,
        );
        services.carts.setItem(ids.user, ids.mug, 2);
        const result = services.orders.checkout(ids.user, 'mutation-quality');
        expect(result.replayed).toBe(false);
        expect(result.order.total).toEqual({ amount: 2598, currency: 'USD' });
        expect(services.carts.get(ids.user).items).toEqual([]);
        expect(repositories.products.getById(ids.mug)?.stock).toBe(10);
    });

    test('keeps ownership and terminal transitions explicit', () => {
        const { services } = setup();
        services.carts.setItem(ids.user, ids.mug, 1);
        const { order } = services.orders.checkout(ids.user, 'terminal');
        expect(() =>
            services.orders.getForActor(
                { userId: ids.admin, role: 'user' },
                order.id,
            ),
        ).toThrow(DomainError);
        expect(() =>
            services.orders.transition(
                { userId: ids.admin, role: 'admin' },
                order.id,
                'processing',
            ),
        ).toThrow(DomainError);
        const shipped = services.orders.transition(
            { userId: ids.admin, role: 'admin' },
            order.id,
            'paid',
        );
        services.orders.transition(
            { userId: ids.admin, role: 'admin' },
            shipped.id,
            'processing',
        );
        services.orders.transition(
            { userId: ids.admin, role: 'admin' },
            shipped.id,
            'shipped',
        );
        expect(() =>
            services.orders.transition(
                { userId: ids.admin, role: 'admin' },
                order.id,
                'cancelled',
            ),
        ).toThrow(DomainError);
    });
});
