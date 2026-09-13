import { relations, sql } from 'drizzle-orm';
import {
    boolean,
    char,
    check,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['user', 'admin']);
export const orderStatus = pgEnum('order_status', [
    'pending',
    'paid',
    'processing',
    'shipped',
    'cancelled',
]);
export const idempotencyStatus = pgEnum('idempotency_status', [
    'in_progress',
    'completed',
    'failed',
]);

export const users = pgTable(
    'users',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        email: varchar('email', { length: 320 }).notNull(),
        passwordHash: text('password_hash').notNull(),
        role: userRole('role').notNull().default('user'),
        createdAt: timestamp('created_at', {
            withTimezone: true,
            mode: 'string',
        })
            .notNull()
            .defaultNow(),
    },
    (table) => [uniqueIndex('users_email_unique').on(table.email)],
);

export const products = pgTable(
    'products',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        name: varchar('name', { length: 200 }).notNull(),
        description: text('description').notNull(),
        category: varchar('category', { length: 100 }).notNull(),
        priceAmount: integer('price_amount').notNull(),
        priceCurrency: char('price_currency', { length: 3 }).notNull(),
        stock: integer('stock').notNull().default(0),
        active: boolean('active').notNull().default(true),
        createdAt: timestamp('created_at', {
            withTimezone: true,
            mode: 'string',
        })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', {
            withTimezone: true,
            mode: 'string',
        })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        check('products_stock_non_negative', sql`${table.stock} >= 0`),
        check(
            'products_price_amount_non_negative',
            sql`${table.priceAmount} >= 0`,
        ),
        index('products_category_active_idx').on(table.category, table.active),
    ],
);

export const carts = pgTable(
    'carts',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at', {
            withTimezone: true,
            mode: 'string',
        })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', {
            withTimezone: true,
            mode: 'string',
        })
            .notNull()
            .defaultNow(),
    },
    (table) => [uniqueIndex('carts_user_unique').on(table.userId)],
);

export const cartItems = pgTable(
    'cart_items',
    {
        cartId: uuid('cart_id')
            .notNull()
            .references(() => carts.id, { onDelete: 'cascade' }),
        productId: uuid('product_id')
            .notNull()
            .references(() => products.id, { onDelete: 'restrict' }),
        quantity: integer('quantity').notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.cartId, table.productId] }),
        check('cart_items_quantity_positive', sql`${table.quantity} > 0`),
    ],
);

export const orders = pgTable(
    'orders',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),
        idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
        status: orderStatus('status').notNull().default('pending'),
        totalAmount: integer('total_amount').notNull(),
        totalCurrency: char('total_currency', { length: 3 }).notNull(),
        createdAt: timestamp('created_at', {
            withTimezone: true,
            mode: 'string',
        })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', {
            withTimezone: true,
            mode: 'string',
        })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        uniqueIndex('orders_user_idempotency_unique').on(
            table.userId,
            table.idempotencyKey,
        ),
        check('orders_total_non_negative', sql`${table.totalAmount} >= 0`),
    ],
);

export const orderLines = pgTable(
    'order_lines',
    {
        orderId: uuid('order_id')
            .notNull()
            .references(() => orders.id, { onDelete: 'cascade' }),
        productId: uuid('product_id')
            .notNull()
            .references(() => products.id, { onDelete: 'restrict' }),
        name: varchar('name', { length: 200 }).notNull(),
        unitPriceAmount: integer('unit_price_amount').notNull(),
        unitPriceCurrency: char('unit_price_currency', {
            length: 3,
        }).notNull(),
        quantity: integer('quantity').notNull(),
        totalAmount: integer('total_amount').notNull(),
        totalCurrency: char('total_currency', { length: 3 }).notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.orderId, table.productId] }),
        check('order_lines_quantity_positive', sql`${table.quantity} > 0`),
        check(
            'order_lines_unit_price_non_negative',
            sql`${table.unitPriceAmount} >= 0`,
        ),
        check('order_lines_total_non_negative', sql`${table.totalAmount} >= 0`),
    ],
);

export const idempotencyRecords = pgTable(
    'idempotency_records',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        key: varchar('key', { length: 128 }).notNull(),
        status: idempotencyStatus('status').notNull().default('in_progress'),
        orderId: uuid('order_id').references(() => orders.id, {
            onDelete: 'set null',
        }),
        response: jsonb('response'),
        createdAt: timestamp('created_at', {
            withTimezone: true,
            mode: 'string',
        })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', {
            withTimezone: true,
            mode: 'string',
        })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        uniqueIndex('idempotency_records_user_key_unique').on(
            table.userId,
            table.key,
        ),
    ],
);

export const usersRelations = relations(users, ({ many }) => ({
    carts: many(carts),
    orders: many(orders),
    idempotencyRecords: many(idempotencyRecords),
}));

export const productsRelations = relations(products, ({ many }) => ({
    cartItems: many(cartItems),
    orderLines: many(orderLines),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
    user: one(users, { fields: [carts.userId], references: [users.id] }),
    items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
    cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
    product: one(products, {
        fields: [cartItems.productId],
        references: [products.id],
    }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
    user: one(users, { fields: [orders.userId], references: [users.id] }),
    lines: many(orderLines),
    idempotencyRecords: many(idempotencyRecords),
}));

export const orderLinesRelations = relations(orderLines, ({ one }) => ({
    order: one(orders, {
        fields: [orderLines.orderId],
        references: [orders.id],
    }),
    product: one(products, {
        fields: [orderLines.productId],
        references: [products.id],
    }),
}));

export const idempotencyRecordsRelations = relations(
    idempotencyRecords,
    ({ one }) => ({
        user: one(users, {
            fields: [idempotencyRecords.userId],
            references: [users.id],
        }),
        order: one(orders, {
            fields: [idempotencyRecords.orderId],
            references: [orders.id],
        }),
    }),
);

export const schema = {
    users,
    products,
    carts,
    cartItems,
    orders,
    orderLines,
    idempotencyRecords,
};

export type UserRow = typeof users.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type CartRow = typeof carts.$inferSelect;
export type CartItemRow = typeof cartItems.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type OrderLineRow = typeof orderLines.$inferSelect;
export type IdempotencyRecordRow = typeof idempotencyRecords.$inferSelect;
