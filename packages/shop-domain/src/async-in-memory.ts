import type {
    AsyncCartRepository,
    AsyncIdempotencyRepository,
    AsyncOrderRepository,
    AsyncProductRepository,
    AsyncShopRepositories,
    AsyncUserRepository,
} from './async-repositories';
import {
    InMemoryCartRepository,
    InMemoryOrderRepository,
    InMemoryProductRepository,
    InMemoryUserRepository,
} from './in-memory';
import type { Cart, Order, Product, ShopSeed, User } from './types';

const clone = <T>(value: T): T => structuredClone(value);

class AsyncInMemoryUsers implements AsyncUserRepository {
    public constructor(private readonly repository: InMemoryUserRepository) {}
    public async getByEmail(email: string): Promise<User | undefined> {
        return this.repository.getByEmail(email);
    }
    public async getById(id: string): Promise<User | undefined> {
        return this.repository.getById(id);
    }
    public async reset(users: User[]): Promise<void> {
        this.repository.reset(users);
    }
    public snapshot(): User[] {
        return this.repository.list();
    }
}

class AsyncInMemoryProducts implements AsyncProductRepository {
    public constructor(
        private readonly repository: InMemoryProductRepository,
    ) {}
    public async getById(id: string): Promise<Product | undefined> {
        return this.repository.getById(id);
    }
    public async list(): Promise<Product[]> {
        return this.repository.list();
    }
    public async updateStock(id: string, stock: number): Promise<void> {
        this.repository.updateStock(id, stock);
    }
    public async decrementStock(
        id: string,
        quantity: number,
    ): Promise<Product | undefined> {
        const product = this.repository.getById(id);
        if (!product || product.stock < quantity) return undefined;
        this.repository.updateStock(id, product.stock - quantity);
        return this.repository.getById(id);
    }
    public async incrementStock(id: string, quantity: number): Promise<void> {
        const product = this.repository.getById(id);
        if (!product) throw new Error(`Cannot update missing product ${id}`);
        this.repository.updateStock(id, product.stock + quantity);
    }
    public async reset(products: Product[]): Promise<void> {
        this.repository.reset(products);
    }
    public snapshot(): Product[] {
        return this.repository.list();
    }
}

class AsyncInMemoryCarts implements AsyncCartRepository {
    public constructor(private readonly repository: InMemoryCartRepository) {}
    public async getByUserId(userId: string): Promise<Cart | undefined> {
        return this.repository.getByUserId(userId);
    }
    public async save(cart: Cart): Promise<void> {
        this.repository.save(cart);
    }
    public async reset(carts: Cart[]): Promise<void> {
        this.repository.reset(carts);
    }
    public snapshot(): Cart[] {
        return this.repository.list();
    }
}

class AsyncInMemoryOrders implements AsyncOrderRepository {
    public constructor(private readonly repository: InMemoryOrderRepository) {}
    public async getById(id: string): Promise<Order | undefined> {
        return this.repository.getById(id);
    }
    public async getByUserAndIdempotencyKey(
        userId: string,
        key: string,
    ): Promise<Order | undefined> {
        return this.repository.getByUserAndIdempotencyKey(userId, key);
    }
    public async listByUserId(userId: string): Promise<Order[]> {
        return this.repository.listByUserId(userId);
    }
    public async listAll(): Promise<Order[]> {
        return this.repository.listAll();
    }
    public async save(order: Order): Promise<void> {
        this.repository.save(order);
    }
    public async reset(orders: Order[]): Promise<void> {
        this.repository.reset(orders);
    }
    public snapshot(): Order[] {
        return this.repository.listAll();
    }
}

class AsyncInMemoryIdempotency implements AsyncIdempotencyRepository {
    private readonly keys = new Set<string>();
    public async claim(userId: string, key: string): Promise<boolean> {
        const value = `${userId}:${key}`;
        if (this.keys.has(value)) return false;
        this.keys.add(value);
        return true;
    }
    public async complete(
        _userId: string,
        _key: string,
        _orderId: string,
    ): Promise<void> {}
    public async reset(): Promise<void> {
        this.keys.clear();
    }
    public snapshot(): string[] {
        return [...this.keys];
    }
    public restore(keys: string[]): void {
        this.keys.clear();
        for (const key of keys) this.keys.add(key);
    }
}

export const createAsyncInMemoryRepositories = (): AsyncShopRepositories => {
    let transactionQueue = Promise.resolve();
    const users = new AsyncInMemoryUsers(new InMemoryUserRepository());
    const products = new AsyncInMemoryProducts(new InMemoryProductRepository());
    const carts = new AsyncInMemoryCarts(new InMemoryCartRepository());
    const orders = new AsyncInMemoryOrders(new InMemoryOrderRepository());
    const idempotency = new AsyncInMemoryIdempotency();
    const repositories: AsyncShopRepositories = {
        users,
        products,
        carts,
        orders,
        idempotency,
        transaction: <T>(
            operation: (repositories: AsyncShopRepositories) => Promise<T>,
        ) => {
            const run = transactionQueue.then(async () => {
                const snapshot = {
                    users: users.snapshot(),
                    products: products.snapshot(),
                    carts: carts.snapshot(),
                    orders: orders.snapshot(),
                    idempotency: idempotency.snapshot(),
                };
                try {
                    return await operation(repositories);
                } catch (error) {
                    await users.reset(snapshot.users);
                    await products.reset(snapshot.products);
                    await carts.reset(snapshot.carts);
                    await orders.reset(snapshot.orders);
                    idempotency.restore(snapshot.idempotency);
                    throw error;
                }
            });
            transactionQueue = run.then(
                () => undefined,
                () => undefined,
            );
            return run;
        },
        reset: async (seed: ShopSeed) => {
            await repositories.users.reset(seed.users.map(clone));
            await repositories.products.reset(seed.products.map(clone));
            await repositories.carts.reset(seed.carts.map(clone));
            await repositories.orders.reset(seed.orders.map(clone));
            await repositories.idempotency.reset();
        },
    };
    return repositories;
};
