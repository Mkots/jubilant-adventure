import {
    emptyCart,
    forbidden,
    insufficientStock,
    invalidCredentials,
    invalidInput,
    invalidTransition,
    notFound,
} from './errors';
import type {
    Actor,
    IdGenerator,
    PasswordVerifier,
    ShopClock,
    ShopRepositories,
} from './repositories';
import type { Cart, Order, OrderStatus, Product, PublicUser } from './types';

const publicUser = ({
    passwordHash: _passwordHash,
    ...user
}: {
    passwordHash: string;
} & PublicUser): PublicUser => ({ ...user });

export class AuthService {
    public constructor(
        private readonly repositories: ShopRepositories,
        private readonly passwordVerifier: PasswordVerifier,
    ) {}

    public verifyCredentials(email: string, password: string): PublicUser {
        const user = this.repositories.users.getByEmail(
            email.trim().toLowerCase(),
        );
        if (
            !user ||
            !this.passwordVerifier.verify(password, user.passwordHash)
        ) {
            throw invalidCredentials();
        }
        return publicUser(user);
    }
}

export interface ProductQuery {
    page: number;
    pageSize: number;
    search?: string;
    category?: string;
    sort?: 'name' | 'price' | 'stock';
    direction?: 'asc' | 'desc';
}

export interface ProductPage {
    items: Product[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export class ProductService {
    public constructor(private readonly repositories: ShopRepositories) {}

    public getById(id: string): Product {
        const product = this.repositories.products.getById(id);
        if (!product?.active) {
            throw notFound('Product');
        }
        return product;
    }

    public list(query: ProductQuery): ProductPage {
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

        const normalizedSearch = query.search?.trim().toLowerCase();
        const filtered = this.repositories.products
            .list()
            .filter((product) => product.active)
            .filter((product) =>
                normalizedSearch
                    ? `${product.name} ${product.description}`
                          .toLowerCase()
                          .includes(normalizedSearch)
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
            return comparison === 0
                ? left.id.localeCompare(right.id)
                : comparison * direction;
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

export class CartService {
    public constructor(private readonly repositories: ShopRepositories) {}

    public get(userId: string): Cart {
        return (
            this.repositories.carts.getByUserId(userId) ?? {
                userId,
                items: [],
            }
        );
    }

    public setItem(userId: string, productId: string, quantity: number): Cart {
        if (!Number.isInteger(quantity) || quantity < 1) {
            throw invalidInput('Quantity must be a positive integer');
        }
        const product = this.repositories.products.getById(productId);
        if (!product?.active) {
            throw notFound('Product');
        }
        if (quantity > product.stock) {
            throw insufficientStock(productId);
        }

        const cart = this.get(userId);
        const items = cart.items.filter((item) => item.productId !== productId);
        items.push({ productId, quantity });
        const updated = { userId, items };
        this.repositories.carts.save(updated);
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

export class OrderService {
    public constructor(
        private readonly repositories: ShopRepositories,
        private readonly clock: ShopClock,
        private readonly idGenerator: IdGenerator,
    ) {}

    public checkout(
        userId: string,
        idempotencyKey: string,
    ): { order: Order; replayed: boolean } {
        if (!idempotencyKey.trim()) {
            throw invalidInput('Idempotency key is required');
        }
        const existing = this.repositories.orders.getByUserAndIdempotencyKey(
            userId,
            idempotencyKey,
        );
        if (existing) {
            return { order: existing, replayed: true };
        }

        const cart = this.repositories.carts.getByUserId(userId);
        if (!cart || cart.items.length === 0) {
            throw emptyCart();
        }

        const products = cart.items.map((item) => {
            const product = this.repositories.products.getById(item.productId);
            if (!product?.active) {
                throw notFound('Product');
            }
            if (item.quantity > product.stock) {
                throw insufficientStock(item.productId);
            }
            return { item, product };
        });

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
        const currency = items[0]?.total.currency ?? 'USD';
        const order: Order = {
            id: this.idGenerator.next(),
            userId,
            idempotencyKey,
            items,
            total: {
                amount: items.reduce((sum, item) => sum + item.total.amount, 0),
                currency,
            },
            status: 'pending',
            createdAt,
            updatedAt: createdAt,
        };

        for (const { item, product } of products) {
            this.repositories.products.updateStock(
                product.id,
                product.stock - item.quantity,
            );
        }
        this.repositories.orders.save(order);
        this.repositories.carts.save({ userId, items: [] });
        return { order, replayed: false };
    }

    public getForActor(actor: Actor, orderId: string): Order {
        const order = this.repositories.orders.getById(orderId);
        if (!order) {
            throw notFound('Order');
        }
        if (actor.role !== 'admin' && actor.userId !== order.userId) {
            throw forbidden('You cannot access this order');
        }
        return order;
    }

    public transition(
        actor: Actor,
        orderId: string,
        status: OrderStatus,
    ): Order {
        if (actor.role !== 'admin') {
            throw forbidden('Only admins can change order status');
        }
        const order = this.repositories.orders.getById(orderId);
        if (!order) {
            throw notFound('Order');
        }
        if (!transitions[order.status].includes(status)) {
            throw invalidTransition(order.status, status);
        }
        const updated = {
            ...order,
            status,
            updatedAt: this.clock.now().toISOString(),
        };
        this.repositories.orders.save(updated);
        return updated;
    }
}

export interface ShopServices {
    auth: AuthService;
    products: ProductService;
    carts: CartService;
    orders: OrderService;
}

export const createShopServices = (
    repositories: ShopRepositories,
    clock: ShopClock,
    idGenerator: IdGenerator,
    passwordVerifier: PasswordVerifier,
): ShopServices => ({
    auth: new AuthService(repositories, passwordVerifier),
    products: new ProductService(repositories),
    carts: new CartService(repositories),
    orders: new OrderService(repositories, clock, idGenerator),
});
