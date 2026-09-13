import type { Actor } from './repositories';
import type { Cart, Order, Product, ShopSeed, User } from './types';

export interface AsyncUserRepository {
    getByEmail(email: string): Promise<User | undefined>;
    getById(id: string): Promise<User | undefined>;
    reset(users: User[]): Promise<void>;
}

export interface AsyncProductRepository {
    getById(id: string): Promise<Product | undefined>;
    list(): Promise<Product[]>;
    updateStock(id: string, stock: number): Promise<void>;
    decrementStock(id: string, quantity: number): Promise<Product | undefined>;
    incrementStock(id: string, quantity: number): Promise<void>;
    reset(products: Product[]): Promise<void>;
}

export interface AsyncCartRepository {
    getByUserId(userId: string): Promise<Cart | undefined>;
    save(cart: Cart): Promise<void>;
    reset(carts: Cart[]): Promise<void>;
}

export interface AsyncOrderRepository {
    getById(id: string): Promise<Order | undefined>;
    getByUserAndIdempotencyKey(
        userId: string,
        idempotencyKey: string,
    ): Promise<Order | undefined>;
    listByUserId(userId: string): Promise<Order[]>;
    listAll(): Promise<Order[]>;
    save(order: Order): Promise<void>;
    reset(orders: Order[]): Promise<void>;
}

export interface AsyncIdempotencyRepository {
    claim(userId: string, key: string): Promise<boolean>;
    complete(userId: string, key: string, orderId: string): Promise<void>;
    reset(): Promise<void>;
}

export interface AsyncShopRepositories {
    users: AsyncUserRepository;
    products: AsyncProductRepository;
    carts: AsyncCartRepository;
    orders: AsyncOrderRepository;
    idempotency: AsyncIdempotencyRepository;
    transaction<T>(
        operation: (repositories: AsyncShopRepositories) => Promise<T>,
    ): Promise<T>;
    reset(seed: ShopSeed): Promise<void>;
    close?(): Promise<void>;
}

export interface AsyncShopClock {
    now(): Date;
}

export interface AsyncIdGenerator {
    next(): string;
    reset?(start?: number): void;
}

export interface AsyncPasswordVerifier {
    verify(password: string, passwordHash: string): boolean | Promise<boolean>;
}

export interface AsyncActor extends Actor {}
