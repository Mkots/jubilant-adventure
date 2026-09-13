import type {
    AsyncCartRepository,
    AsyncIdempotencyRepository,
    AsyncOrderRepository,
    AsyncProductRepository,
    AsyncShopRepositories,
    AsyncUserRepository,
    Cart,
    Order,
    Product,
    ShopSeed,
    User,
} from '@jubilant-adventure/shop-domain';
import { conflict } from '@jubilant-adventure/shop-domain';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { ShopDatabase } from './client';
import {
    cartItems,
    carts,
    idempotencyRecords,
    orderLines,
    orders,
    products,
    users,
} from './schema';

type DatabaseLike = ShopDatabase;

const mapUser = (row: typeof users.$inferSelect): User => ({
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role,
});
const mapProduct = (row: typeof products.$inferSelect): Product => ({
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    price: { amount: row.priceAmount, currency: row.priceCurrency.trim() },
    stock: row.stock,
    active: row.active,
});
const mapCart = (
    row: typeof carts.$inferSelect,
    items: Array<typeof cartItems.$inferSelect>,
): Cart => ({
    userId: row.userId,
    items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
    })),
});
const mapOrder = (
    row: typeof orders.$inferSelect,
    lines: Array<typeof orderLines.$inferSelect>,
): Order => ({
    id: row.id,
    userId: row.userId,
    idempotencyKey: row.idempotencyKey,
    items: lines.map((line) => ({
        productId: line.productId,
        name: line.name,
        unitPrice: {
            amount: line.unitPriceAmount,
            currency: line.unitPriceCurrency.trim(),
        },
        quantity: line.quantity,
        total: {
            amount: line.totalAmount,
            currency: line.totalCurrency.trim(),
        },
    })),
    total: { amount: row.totalAmount, currency: row.totalCurrency.trim() },
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
});

const providerError = (error: unknown): never => {
    if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
    )
        throw conflict('A resource with this unique key already exists');
    throw error;
};

class DrizzleUsers implements AsyncUserRepository {
    public constructor(private readonly db: DatabaseLike) {}
    public async getByEmail(email: string): Promise<User | undefined> {
        const rows = await this.db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
        return rows[0] ? mapUser(rows[0]) : undefined;
    }
    public async getById(id: string): Promise<User | undefined> {
        const rows = await this.db
            .select()
            .from(users)
            .where(eq(users.id, id))
            .limit(1);
        return rows[0] ? mapUser(rows[0]) : undefined;
    }
    public async reset(values: User[]): Promise<void> {
        if (values.length === 0) return;
        try {
            await this.db
                .insert(users)
                .values(
                    values.map((value) => ({
                        id: value.id,
                        email: value.email,
                        passwordHash: value.passwordHash,
                        role: value.role,
                    })),
                )
                .onConflictDoNothing();
        } catch (error) {
            providerError(error);
        }
    }
}

class DrizzleProducts implements AsyncProductRepository {
    public constructor(private readonly db: DatabaseLike) {}
    public async getById(id: string): Promise<Product | undefined> {
        const rows = await this.db
            .select()
            .from(products)
            .where(eq(products.id, id))
            .limit(1);
        return rows[0] ? mapProduct(rows[0]) : undefined;
    }
    public async list(): Promise<Product[]> {
        const rows = await this.db
            .select()
            .from(products)
            .orderBy(asc(products.name), asc(products.id));
        return rows.map(mapProduct);
    }
    public async updateStock(id: string, stock: number): Promise<void> {
        await this.db
            .update(products)
            .set({ stock, updatedAt: new Date().toISOString() })
            .where(eq(products.id, id));
    }
    public async decrementStock(
        id: string,
        quantity: number,
    ): Promise<Product | undefined> {
        const rows = await this.db
            .update(products)
            .set({
                stock: sql`${products.stock} - ${quantity}`,
                updatedAt: new Date().toISOString(),
            })
            .where(
                and(eq(products.id, id), sql`${products.stock} >= ${quantity}`),
            )
            .returning();
        return rows[0] ? mapProduct(rows[0]) : undefined;
    }
    public async incrementStock(id: string, quantity: number): Promise<void> {
        await this.db
            .update(products)
            .set({
                stock: sql`${products.stock} + ${quantity}`,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(products.id, id));
    }
    public async reset(values: Product[]): Promise<void> {
        if (values.length === 0) return;
        await this.db
            .insert(products)
            .values(
                values.map((value) => ({
                    id: value.id,
                    name: value.name,
                    description: value.description,
                    category: value.category,
                    priceAmount: value.price.amount,
                    priceCurrency: value.price.currency,
                    stock: value.stock,
                    active: value.active,
                })),
            )
            .onConflictDoNothing();
    }
}

class DrizzleCarts implements AsyncCartRepository {
    public constructor(private readonly db: DatabaseLike) {}
    public async getByUserId(userId: string): Promise<Cart | undefined> {
        const rows = await this.db
            .select()
            .from(carts)
            .where(eq(carts.userId, userId))
            .limit(1);
        const row = rows[0];
        if (!row) return undefined;
        const items = await this.db
            .select()
            .from(cartItems)
            .where(eq(cartItems.cartId, row.id));
        return mapCart(row, items);
    }
    public async save(cart: Cart): Promise<void> {
        const existing = await this.db
            .select({ id: carts.id })
            .from(carts)
            .where(eq(carts.userId, cart.userId))
            .limit(1);
        const cartId = existing[0]?.id ?? crypto.randomUUID();
        await this.db
            .insert(carts)
            .values({ id: cartId, userId: cart.userId })
            .onConflictDoUpdate({
                target: carts.userId,
                set: { updatedAt: new Date().toISOString() },
            });
        await this.db.delete(cartItems).where(eq(cartItems.cartId, cartId));
        if (cart.items.length > 0)
            await this.db.insert(cartItems).values(
                cart.items.map((item) => ({
                    cartId,
                    productId: item.productId,
                    quantity: item.quantity,
                })),
            );
    }
    public async reset(values: Cart[]): Promise<void> {
        for (const value of values) await this.save(value);
    }
}

class DrizzleOrders implements AsyncOrderRepository {
    public constructor(private readonly db: DatabaseLike) {}
    private async withLines(row: typeof orders.$inferSelect): Promise<Order> {
        const lines = await this.db
            .select()
            .from(orderLines)
            .where(eq(orderLines.orderId, row.id))
            .orderBy(asc(orderLines.productId));
        return mapOrder(row, lines);
    }
    public async getById(id: string): Promise<Order | undefined> {
        const rows = await this.db
            .select()
            .from(orders)
            .where(eq(orders.id, id))
            .limit(1);
        return rows[0] ? this.withLines(rows[0]) : undefined;
    }
    public async getByUserAndIdempotencyKey(
        userId: string,
        key: string,
    ): Promise<Order | undefined> {
        const rows = await this.db
            .select()
            .from(orders)
            .where(
                and(eq(orders.userId, userId), eq(orders.idempotencyKey, key)),
            )
            .limit(1);
        return rows[0] ? this.withLines(rows[0]) : undefined;
    }
    public async listByUserId(userId: string): Promise<Order[]> {
        const rows = await this.db
            .select()
            .from(orders)
            .where(eq(orders.userId, userId))
            .orderBy(asc(orders.createdAt));
        return Promise.all(rows.map((row) => this.withLines(row)));
    }
    public async listAll(): Promise<Order[]> {
        const rows = await this.db
            .select()
            .from(orders)
            .orderBy(asc(orders.createdAt));
        return Promise.all(rows.map((row) => this.withLines(row)));
    }
    public async save(order: Order): Promise<void> {
        try {
            await this.db
                .insert(orders)
                .values({
                    id: order.id,
                    userId: order.userId,
                    idempotencyKey: order.idempotencyKey,
                    status: order.status,
                    totalAmount: order.total.amount,
                    totalCurrency: order.total.currency,
                    createdAt: order.createdAt,
                    updatedAt: order.updatedAt,
                })
                .onConflictDoUpdate({
                    target: orders.id,
                    set: { status: order.status, updatedAt: order.updatedAt },
                });
            await this.db
                .delete(orderLines)
                .where(eq(orderLines.orderId, order.id));
            if (order.items.length > 0)
                await this.db.insert(orderLines).values(
                    order.items.map((item) => ({
                        orderId: order.id,
                        productId: item.productId,
                        name: item.name,
                        unitPriceAmount: item.unitPrice.amount,
                        unitPriceCurrency: item.unitPrice.currency,
                        quantity: item.quantity,
                        totalAmount: item.total.amount,
                        totalCurrency: item.total.currency,
                    })),
                );
        } catch (error) {
            providerError(error);
        }
    }
    public async reset(values: Order[]): Promise<void> {
        for (const value of values) await this.save(value);
    }
}

class DrizzleIdempotency implements AsyncIdempotencyRepository {
    public constructor(private readonly db: DatabaseLike) {}
    public async claim(userId: string, key: string): Promise<boolean> {
        const rows = await this.db
            .insert(idempotencyRecords)
            .values({ userId, key, status: 'in_progress' })
            .onConflictDoNothing({
                target: [idempotencyRecords.userId, idempotencyRecords.key],
            })
            .returning({ id: idempotencyRecords.id });
        return rows.length > 0;
    }
    public async complete(
        userId: string,
        key: string,
        orderId: string,
    ): Promise<void> {
        await this.db
            .update(idempotencyRecords)
            .set({
                status: 'completed',
                orderId,
                updatedAt: new Date().toISOString(),
            })
            .where(
                and(
                    eq(idempotencyRecords.userId, userId),
                    eq(idempotencyRecords.key, key),
                ),
            );
    }
    public async reset(): Promise<void> {
        await this.db.delete(idempotencyRecords);
    }
}

export const createPostgresRepositories = (
    db: ShopDatabase,
): AsyncShopRepositories => {
    const repositories: AsyncShopRepositories = {
        users: new DrizzleUsers(db),
        products: new DrizzleProducts(db),
        carts: new DrizzleCarts(db),
        orders: new DrizzleOrders(db),
        idempotency: new DrizzleIdempotency(db),
        transaction: async <T>(
            operation: (repositories: AsyncShopRepositories) => Promise<T>,
        ) =>
            db.transaction(async (transaction) =>
                operation(
                    createPostgresRepositories(
                        transaction as unknown as ShopDatabase,
                    ),
                ),
            ),
        reset: async (seed: ShopSeed) =>
            db.transaction(async (transaction) => {
                const tx = transaction as unknown as ShopDatabase;
                await tx.delete(cartItems);
                await tx.delete(carts);
                await tx.delete(idempotencyRecords);
                await tx.delete(orderLines);
                await tx.delete(orders);
                await tx.delete(products);
                await tx.delete(users);
                const target = createPostgresRepositories(tx);
                await target.users.reset(seed.users);
                await target.products.reset(seed.products);
                await target.carts.reset(seed.carts);
                await target.orders.reset(seed.orders);
            }),
        close: async () => undefined,
    };
    return repositories;
};
