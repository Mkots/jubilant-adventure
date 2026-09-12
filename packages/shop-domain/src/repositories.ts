import type { Cart, Order, Product, ShopSeed, User } from './types';

export interface UserRepository {
    getByEmail(email: string): User | undefined;
    getById(id: string): User | undefined;
    reset(users: User[]): void;
}

export interface ProductRepository {
    getById(id: string): Product | undefined;
    list(): Product[];
    updateStock(id: string, stock: number): void;
    reset(products: Product[]): void;
}

export interface CartRepository {
    getByUserId(userId: string): Cart | undefined;
    save(cart: Cart): void;
    reset(carts: Cart[]): void;
}

export interface OrderRepository {
    getById(id: string): Order | undefined;
    getByUserAndIdempotencyKey(
        userId: string,
        idempotencyKey: string,
    ): Order | undefined;
    listByUserId(userId: string): Order[];
    listAll(): Order[];
    save(order: Order): void;
    reset(orders: Order[]): void;
}

export interface ShopRepositories {
    users: UserRepository;
    products: ProductRepository;
    carts: CartRepository;
    orders: OrderRepository;
}

export interface ShopClock {
    now(): Date;
}

export interface IdGenerator {
    next(): string;
}

export interface PasswordVerifier {
    verify(password: string, passwordHash: string): boolean;
}

export interface Actor {
    userId: string;
    role: User['role'];
}

export const resetRepositories = (
    repositories: ShopRepositories,
    seed: ShopSeed,
): void => {
    repositories.users.reset(seed.users);
    repositories.products.reset(seed.products);
    repositories.carts.reset(seed.carts);
    repositories.orders.reset(seed.orders);
};
