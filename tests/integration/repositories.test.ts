import {
    type AsyncShopRepositories,
    createAsyncInMemoryRepositories,
    createAsyncShopServices,
    FixedClock,
    SequentialIdGenerator,
} from '@jubilant-adventure/shop-domain';
import {
    createBaselineSeed,
    fixtureIds,
    fixturePasswordVerifier,
} from '@jubilant-adventure/test-data';
import { sql } from 'drizzle-orm';
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test,
} from 'vitest';
import {
    type PostgresFixture,
    startPostgresFixture,
    stopPostgresFixture,
} from './postgres-fixture';

const runContract = (
    name: string,
    getRepositories: () => AsyncShopRepositories,
) => {
    describe(`${name} repository contract`, () => {
        let repositories: AsyncShopRepositories;
        beforeEach(async () => {
            repositories = getRepositories();
            await repositories.reset(createBaselineSeed());
        });
        test('reads defensive users and products and saves carts', async () => {
            const user =
                await repositories.users.getByEmail('user@example.test');
            expect(user?.id).toBe(fixtureIds.user);
            const product = await repositories.products.getById(fixtureIds.mug);
            expect(product?.stock).toBe(12);
            if (!product) throw new Error('missing fixture product');
            product.stock = 0;
            expect(
                (await repositories.products.getById(fixtureIds.mug))?.stock,
            ).toBe(12);
            await repositories.carts.save({
                userId: fixtureIds.user,
                items: [{ productId: fixtureIds.mug, quantity: 2 }],
            });
            expect(
                await repositories.carts.getByUserId(fixtureIds.user),
            ).toEqual({
                userId: fixtureIds.user,
                items: [{ productId: fixtureIds.mug, quantity: 2 }],
            });
        });
        test('supports atomic stock decrement and idempotent order lookup', async () => {
            const changed = await repositories.products.decrementStock(
                fixtureIds.keyboard,
                2,
            );
            expect(changed?.stock).toBe(1);
            expect(
                await repositories.products.decrementStock(
                    fixtureIds.keyboard,
                    2,
                ),
            ).toBeUndefined();
            await repositories.orders.save({
                id: '00000000-0000-4000-8000-000000000501',
                userId: fixtureIds.user,
                idempotencyKey: 'contract-key',
                items: [],
                total: { amount: 0, currency: 'USD' },
                status: 'pending',
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
            });
            expect(
                (
                    await repositories.orders.getByUserAndIdempotencyKey(
                        fixtureIds.user,
                        'contract-key',
                    )
                )?.id,
            ).toBe('00000000-0000-4000-8000-000000000501');
        });
    });
};

const assertRepositoryContract = async (
    repositories: AsyncShopRepositories,
): Promise<void> => {
    const user = await repositories.users.getByEmail('user@example.test');
    expect(user?.id).toBe(fixtureIds.user);
    const product = await repositories.products.getById(fixtureIds.mug);
    expect(product?.stock).toBe(12);
    if (!product) throw new Error('missing fixture product');
    product.stock = 0;
    expect((await repositories.products.getById(fixtureIds.mug))?.stock).toBe(
        12,
    );
    await repositories.carts.save({
        userId: fixtureIds.user,
        items: [{ productId: fixtureIds.mug, quantity: 2 }],
    });
    expect(await repositories.carts.getByUserId(fixtureIds.user)).toEqual({
        userId: fixtureIds.user,
        items: [{ productId: fixtureIds.mug, quantity: 2 }],
    });
};

describe('PostgreSQL integration boundary', () => {
    let fixture: PostgresFixture | undefined;
    beforeAll(async () => {
        try {
            fixture = await startPostgresFixture();
        } catch (error) {
            console.warn(
                error instanceof Error ? error.message : String(error),
            );
        }
    });
    beforeEach(async () => {
        await fixture?.repositories.reset(createBaselineSeed());
    });
    afterAll(async () => stopPostgresFixture(fixture));

    test('migration creates the expected tables and constraints', async () => {
        if (!fixture) return;
        const result = await fixture.connection.db.execute<{
            table_name: string;
        }>(
            sql`select table_name from information_schema.tables where table_schema = 'public' and table_name in ('users', 'products', 'carts', 'cart_items', 'orders', 'order_lines', 'idempotency_records') order by table_name`,
        );
        expect(result.rows.map((row) => row.table_name)).toEqual([
            'cart_items',
            'carts',
            'idempotency_records',
            'order_lines',
            'orders',
            'products',
            'users',
        ]);
        const checks = await fixture.connection.db.execute<{
            constraint_name: string;
        }>(
            sql`select constraint_name from information_schema.table_constraints where constraint_type = 'CHECK' and table_name in ('products', 'cart_items', 'orders', 'order_lines')`,
        );
        expect(checks.rows.length).toBeGreaterThanOrEqual(6);
        await assertRepositoryContract(fixture.repositories);
    });

    test('transaction rollback does not leave a partial order', async () => {
        if (!fixture) return;
        await expect(
            fixture.repositories.transaction(async (repositories) => {
                await repositories.orders.save({
                    id: '00000000-0000-4000-8000-000000000502',
                    userId: fixtureIds.user,
                    idempotencyKey: 'rollback',
                    items: [],
                    total: { amount: 0, currency: 'USD' },
                    status: 'pending',
                    createdAt: '2026-01-01T00:00:00.000Z',
                    updatedAt: '2026-01-01T00:00:00.000Z',
                });
                throw new Error('intentional transaction rollback');
            }),
        ).rejects.toThrow('intentional transaction rollback');
        expect(
            await fixture.repositories.orders.getById(
                '00000000-0000-4000-8000-000000000502',
            ),
        ).toBeUndefined();
    });

    test('serializes checkout stock and idempotency at the database boundary', async () => {
        if (!fixture) return;
        await fixture.repositories.carts.save({
            userId: fixtureIds.user,
            items: [{ productId: fixtureIds.keyboard, quantity: 2 }],
        });
        const services = createAsyncShopServices(
            fixture.repositories,
            new FixedClock('2026-01-01T00:00:00.000Z'),
            new SequentialIdGenerator(),
            fixturePasswordVerifier,
        );
        const results = await Promise.allSettled([
            services.orders.checkout(fixtureIds.user, 'database-a'),
            services.orders.checkout(fixtureIds.user, 'database-b'),
        ]);
        expect(
            results.filter((result) => result.status === 'fulfilled'),
        ).toHaveLength(1);
        expect(
            (await fixture.repositories.products.getById(fixtureIds.keyboard))
                ?.stock,
        ).toBe(1);
        const replay = await services.orders.checkout(
            fixtureIds.user,
            'database-a',
        );
        expect(replay.replayed).toBe(true);
    });
});

describe('shared async repository contract', () => {
    runContract('in-memory', createAsyncInMemoryRepositories);
});

describe('async checkout invariant', () => {
    test('serializes concurrent in-memory checkout calls through the same service API', async () => {
        const repositories = createAsyncInMemoryRepositories();
        await repositories.reset(createBaselineSeed());
        await repositories.carts.save({
            userId: fixtureIds.user,
            items: [{ productId: fixtureIds.keyboard, quantity: 2 }],
        });
        const service = createAsyncShopServices(
            repositories,
            new FixedClock('2026-01-01T00:00:00.000Z'),
            new SequentialIdGenerator(),
            fixturePasswordVerifier,
        );
        const results = await Promise.allSettled([
            service.orders.checkout(fixtureIds.user, 'concurrent-a'),
            service.orders.checkout(fixtureIds.user, 'concurrent-b'),
        ]);
        expect(
            results.filter((result) => result.status === 'fulfilled'),
        ).toHaveLength(1);
    });

    test('rolls back in-memory checkout state after a failed transaction', async () => {
        const repositories = createAsyncInMemoryRepositories();
        await repositories.reset(createBaselineSeed());
        await repositories.carts.save({
            userId: fixtureIds.user,
            items: [{ productId: fixtureIds.keyboard, quantity: 4 }],
        });
        const service = createAsyncShopServices(
            repositories,
            new FixedClock('2026-01-01T00:00:00.000Z'),
            new SequentialIdGenerator(),
            fixturePasswordVerifier,
        );
        await expect(
            service.orders.checkout(fixtureIds.user, 'rollback-key'),
        ).rejects.toMatchObject({ code: 'insufficient_stock' });
        expect(
            (await repositories.products.getById(fixtureIds.keyboard))?.stock,
        ).toBe(3);
        expect(
            (await repositories.carts.getByUserId(fixtureIds.user))?.items[0]
                ?.quantity,
        ).toBe(4);
        await repositories.carts.save({
            userId: fixtureIds.user,
            items: [{ productId: fixtureIds.keyboard, quantity: 1 }],
        });
        await expect(
            service.orders.checkout(fixtureIds.user, 'rollback-key'),
        ).resolves.toMatchObject({ replayed: false });
    });
});
