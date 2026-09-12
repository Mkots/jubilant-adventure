import type {
    CartRepository,
    IdGenerator,
    OrderRepository,
    ProductRepository,
    ShopClock,
    ShopRepositories,
    UserRepository,
} from './repositories';
import type { Cart, Order, Product, User } from './types';

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryUserRepository implements UserRepository {
    private users = new Map<string, User>();

    public constructor(users: User[] = []) {
        this.reset(users);
    }

    public getByEmail(email: string): User | undefined {
        const user = [...this.users.values()].find(
            (candidate) => candidate.email === email.toLowerCase(),
        );
        return user ? clone(user) : undefined;
    }

    public getById(id: string): User | undefined {
        const user = this.users.get(id);
        return user ? clone(user) : undefined;
    }

    public reset(users: User[]): void {
        this.users = new Map(users.map((user) => [user.id, clone(user)]));
    }
}

export class InMemoryProductRepository implements ProductRepository {
    private products = new Map<string, Product>();

    public constructor(products: Product[] = []) {
        this.reset(products);
    }

    public getById(id: string): Product | undefined {
        const product = this.products.get(id);
        return product ? clone(product) : undefined;
    }

    public list(): Product[] {
        return [...this.products.values()].map(clone);
    }

    public updateStock(id: string, stock: number): void {
        const product = this.products.get(id);
        if (!product) {
            throw new Error(`Cannot update missing product ${id}`);
        }
        this.products.set(id, { ...product, stock });
    }

    public reset(products: Product[]): void {
        this.products = new Map(
            products.map((product) => [product.id, clone(product)]),
        );
    }
}

export class InMemoryCartRepository implements CartRepository {
    private carts = new Map<string, Cart>();

    public constructor(carts: Cart[] = []) {
        this.reset(carts);
    }

    public getByUserId(userId: string): Cart | undefined {
        const cart = this.carts.get(userId);
        return cart ? clone(cart) : undefined;
    }

    public save(cart: Cart): void {
        this.carts.set(cart.userId, clone(cart));
    }

    public reset(carts: Cart[]): void {
        this.carts = new Map(carts.map((cart) => [cart.userId, clone(cart)]));
    }
}

export class InMemoryOrderRepository implements OrderRepository {
    private orders = new Map<string, Order>();

    public constructor(orders: Order[] = []) {
        this.reset(orders);
    }

    public getById(id: string): Order | undefined {
        const order = this.orders.get(id);
        return order ? clone(order) : undefined;
    }

    public getByUserAndIdempotencyKey(
        userId: string,
        idempotencyKey: string,
    ): Order | undefined {
        const order = [...this.orders.values()].find(
            (candidate) =>
                candidate.userId === userId &&
                candidate.idempotencyKey === idempotencyKey,
        );
        return order ? clone(order) : undefined;
    }

    public listByUserId(userId: string): Order[] {
        return [...this.orders.values()]
            .filter((order) => order.userId === userId)
            .map(clone);
    }

    public listAll(): Order[] {
        return [...this.orders.values()].map(clone);
    }

    public save(order: Order): void {
        this.orders.set(order.id, clone(order));
    }

    public reset(orders: Order[]): void {
        this.orders = new Map(orders.map((order) => [order.id, clone(order)]));
    }
}

export class SystemClock implements ShopClock {
    public now(): Date {
        return new Date();
    }
}

export class FixedClock implements ShopClock {
    private current: Date;

    public constructor(value: string | Date) {
        this.current = new Date(value);
    }

    public now(): Date {
        return new Date(this.current);
    }

    public set(value: string | Date): void {
        this.current = new Date(value);
    }
}

export class SequentialIdGenerator implements IdGenerator {
    private sequence: number;

    public constructor(start = 1) {
        this.sequence = start;
    }

    public next(): string {
        const id = `00000000-0000-4000-8000-${this.sequence
            .toString(16)
            .padStart(12, '0')}`;
        this.sequence += 1;
        return id;
    }

    public reset(start = 1): void {
        this.sequence = start;
    }
}

export const createInMemoryRepositories = (): ShopRepositories => ({
    users: new InMemoryUserRepository(),
    products: new InMemoryProductRepository(),
    carts: new InMemoryCartRepository(),
    orders: new InMemoryOrderRepository(),
});
