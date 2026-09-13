import type {
    AsyncIdGenerator,
    AsyncPasswordVerifier,
    AsyncShopClock,
    AsyncShopRepositories,
} from './async-repositories';
import {
    emptyCart,
    forbidden,
    insufficientStock,
    invalidCredentials,
    invalidInput,
    invalidTransition,
    notFound,
} from './errors';
import type { Actor } from './repositories';
import type { Cart, Order, OrderStatus, Product, PublicUser } from './types';

const publicUser = ({
    passwordHash: _passwordHash,
    ...user
}: { passwordHash: string } & PublicUser): PublicUser => ({ ...user });

export class AsyncAuthService {
    public constructor(
        private readonly repositories: AsyncShopRepositories,
        private readonly passwordVerifier: AsyncPasswordVerifier,
    ) {}

    public async verifyCredentials(
        email: string,
        password: string,
    ): Promise<PublicUser> {
        const user = await this.repositories.users.getByEmail(
            email.trim().toLowerCase(),
        );
        if (
            !user ||
            !(await this.passwordVerifier.verify(password, user.passwordHash))
        ) {
            throw invalidCredentials();
        }
        return publicUser(user);
    }
}

export class AsyncProductService {
    public constructor(private readonly repositories: AsyncShopRepositories) {}

    public async getById(id: string): Promise<Product> {
        const product = await this.repositories.products.getById(id);
        if (!product?.active) throw notFound('Product');
        return product;
    }

    public async list(query: {
        page: number;
        pageSize: number;
        search?: string;
        category?: string;
        sort?: 'name' | 'price' | 'stock';
        direction?: 'asc' | 'desc';
    }): Promise<{
        items: Product[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    }> {
        if (
            !Number.isInteger(query.page) ||
            query.page < 1 ||
            !Number.isInteger(query.pageSize) ||
            query.pageSize < 1 ||
            query.pageSize > 100
        ) {
            throw invalidInput(
                'Page must be positive and pageSize must be between 1 and 100',
            );
        }
        const search = query.search?.trim().toLowerCase();
        const filtered = (await this.repositories.products.list())
            .filter((product) => product.active)
            .filter((product) =>
                search
                    ? `${product.name} ${product.description}`
                          .toLowerCase()
                          .includes(search)
                    : true,
            )
            .filter((product) =>
                query.category ? product.category === query.category : true,
            );
        const direction = query.direction === 'desc' ? -1 : 1;
        const sort = query.sort ?? 'name';
        filtered.sort((left, right) => {
            const leftValue =
                sort === 'price'
                    ? left.price.amount
                    : sort === 'stock'
                      ? left.stock
                      : left.name;
            const rightValue =
                sort === 'price'
                    ? right.price.amount
                    : sort === 'stock'
                      ? right.stock
                      : right.name;
            const comparison =
                typeof leftValue === 'string'
                    ? leftValue.localeCompare(rightValue as string)
                    : leftValue - (rightValue as number);
            return (
                (comparison === 0
                    ? left.id.localeCompare(right.id)
                    : comparison) * direction
            );
        });
        const start = (query.page - 1) * query.pageSize;
        return {
            items: filtered.slice(start, start + query.pageSize),
            total: filtered.length,
            page: query.page,
            pageSize: query.pageSize,
            totalPages: Math.ceil(filtered.length / query.pageSize),
        };
    }
}

export class AsyncCartService {
    public constructor(private readonly repositories: AsyncShopRepositories) {}

    public async get(userId: string): Promise<Cart> {
        return (
            (await this.repositories.carts.getByUserId(userId)) ?? {
                userId,
                items: [],
            }
        );
    }

    public async setItem(
        userId: string,
        productId: string,
        quantity: number,
    ): Promise<Cart> {
        if (!Number.isInteger(quantity) || quantity < 1)
            throw invalidInput('Quantity must be a positive integer');
        const product = await this.repositories.products.getById(productId);
        if (!product?.active) throw notFound('Product');
        if (quantity > product.stock) throw insufficientStock(productId);
        const cart = await this.get(userId);
        const updated = {
            userId,
            items: [
                ...cart.items.filter((item) => item.productId !== productId),
                { productId, quantity },
            ],
        };
        await this.repositories.carts.save(updated);
        return updated;
    }
}

const transitions: Record<OrderStatus, OrderStatus[]> = {
    pending: ['paid', 'cancelled'],
    paid: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: [],
    cancelled: [],
};

export class AsyncOrderService {
    public constructor(
        private readonly repositories: AsyncShopRepositories,
        private readonly clock: AsyncShopClock,
        private readonly idGenerator: AsyncIdGenerator,
    ) {}

    public async checkout(
        userId: string,
        idempotencyKey: string,
    ): Promise<{ order: Order; replayed: boolean }> {
        if (!idempotencyKey.trim())
            throw invalidInput('Idempotency key is required');
        return this.repositories.transaction(async (repositories) => {
            const existing =
                await repositories.orders.getByUserAndIdempotencyKey(
                    userId,
                    idempotencyKey,
                );
            if (existing) return { order: existing, replayed: true };
            if (
                !(await repositories.idempotency.claim(userId, idempotencyKey))
            ) {
                const claimedOrder =
                    await repositories.orders.getByUserAndIdempotencyKey(
                        userId,
                        idempotencyKey,
                    );
                if (claimedOrder)
                    return { order: claimedOrder, replayed: true };
                throw invalidInput(
                    'Checkout with this idempotency key is already in progress',
                );
            }
            const cart = await repositories.carts.getByUserId(userId);
            if (!cart || cart.items.length === 0) throw emptyCart();
            const products = [] as Array<{
                item: Cart['items'][number];
                product: Product;
            }>;
            for (const item of cart.items) {
                const product = await repositories.products.getById(
                    item.productId,
                );
                if (!product?.active) throw notFound('Product');
                if (item.quantity > product.stock)
                    throw insufficientStock(item.productId);
                products.push({ item, product });
            }
            const createdAt = this.clock.now().toISOString();
            const items = products.map(({ item, product }) => ({
                productId: product.id,
                name: product.name,
                unitPrice: { ...product.price },
                quantity: item.quantity,
                total: {
                    amount: product.price.amount * item.quantity,
                    currency: product.price.currency,
                },
            }));
            const order: Order = {
                id: this.idGenerator.next(),
                userId,
                idempotencyKey,
                items,
                total: {
                    amount: items.reduce(
                        (sum, item) => sum + item.total.amount,
                        0,
                    ),
                    currency: items[0]?.total.currency ?? 'USD',
                },
                status: 'pending',
                createdAt,
                updatedAt: createdAt,
            };
            for (const { item, product } of products) {
                const updated = await repositories.products.decrementStock(
                    product.id,
                    item.quantity,
                );
                if (!updated) throw insufficientStock(item.productId);
            }
            await repositories.orders.save(order);
            await repositories.idempotency.complete(
                userId,
                idempotencyKey,
                order.id,
            );
            await repositories.carts.save({ userId, items: [] });
            return { order, replayed: false };
        });
    }

    public async getForActor(actor: Actor, orderId: string): Promise<Order> {
        const order = await this.repositories.orders.getById(orderId);
        if (!order) throw notFound('Order');
        if (actor.role !== 'admin' && actor.userId !== order.userId)
            throw forbidden('You cannot access this order');
        return order;
    }

    public async transition(
        actor: Actor,
        orderId: string,
        status: OrderStatus,
    ): Promise<Order> {
        if (actor.role !== 'admin')
            throw forbidden('Only admins can change order status');
        return this.repositories.transaction(async (repositories) => {
            const order = await repositories.orders.getById(orderId);
            if (!order) throw notFound('Order');
            if (!transitions[order.status].includes(status))
                throw invalidTransition(order.status, status);
            const updated = {
                ...order,
                status,
                updatedAt: this.clock.now().toISOString(),
            };
            await repositories.orders.save(updated);
            return updated;
        });
    }

    public async cancelPendingCheckout(orderId: string): Promise<Order> {
        return this.repositories.transaction(async (repositories) => {
            const order = await repositories.orders.getById(orderId);
            if (!order) throw notFound('Order');
            if (order.status !== 'pending') return order;
            for (const item of order.items)
                await repositories.products.incrementStock(
                    item.productId,
                    item.quantity,
                );
            await repositories.carts.save({
                userId: order.userId,
                items: order.items.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                })),
            });
            const cancelled = {
                ...order,
                status: 'cancelled' as const,
                updatedAt: this.clock.now().toISOString(),
            };
            await repositories.orders.save(cancelled);
            return cancelled;
        });
    }
}

export interface AsyncShopServices {
    auth: AsyncAuthService;
    products: AsyncProductService;
    carts: AsyncCartService;
    orders: AsyncOrderService;
}

export const createAsyncShopServices = (
    repositories: AsyncShopRepositories,
    clock: AsyncShopClock,
    idGenerator: AsyncIdGenerator,
    passwordVerifier: AsyncPasswordVerifier,
): AsyncShopServices => ({
    auth: new AsyncAuthService(repositories, passwordVerifier),
    products: new AsyncProductService(repositories),
    carts: new AsyncCartService(repositories),
    orders: new AsyncOrderService(repositories, clock, idGenerator),
});
