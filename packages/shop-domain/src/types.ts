export type Role = 'user' | 'admin';

export type OrderStatus =
    | 'pending'
    | 'paid'
    | 'processing'
    | 'shipped'
    | 'cancelled';

export interface Money {
    amount: number;
    currency: string;
}

export interface User {
    id: string;
    email: string;
    passwordHash: string;
    role: Role;
}

export type PublicUser = Omit<User, 'passwordHash'>;

export interface Product {
    id: string;
    name: string;
    description: string;
    category: string;
    price: Money;
    stock: number;
    active: boolean;
}

export interface CartItem {
    productId: string;
    quantity: number;
}

export interface Cart {
    userId: string;
    items: CartItem[];
}

export interface OrderLine {
    productId: string;
    name: string;
    unitPrice: Money;
    quantity: number;
    total: Money;
}

export interface Order {
    id: string;
    userId: string;
    idempotencyKey: string;
    items: OrderLine[];
    total: Money;
    status: OrderStatus;
    createdAt: string;
    updatedAt: string;
}

export interface ShopSeed {
    users: User[];
    products: Product[];
    carts: Cart[];
    orders: Order[];
}
