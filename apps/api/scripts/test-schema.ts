import { sql } from 'drizzle-orm';
import { createDatabase, migrateDatabase } from '../src/db/client';

const connection = createDatabase();

const main = async (): Promise<void> => {
    try {
        await migrateDatabase(connection.db);
        const result = await connection.db.execute<{ table_name: string }>(sql`
            select table_name
            from information_schema.tables
            where table_schema = 'public'
              and table_name in ('users', 'products', 'carts', 'cart_items', 'orders', 'order_lines', 'idempotency_records')
            order by table_name
        `);
        const actual = result.rows.map((row) => row.table_name);
        const expected = [
            'cart_items',
            'carts',
            'idempotency_records',
            'order_lines',
            'orders',
            'products',
            'users',
        ];
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`Schema tables differ: ${actual.join(', ')}`);
        }
        process.stdout.write(`Schema OK: ${actual.join(', ')}\n`);
    } finally {
        await connection.close();
    }
};

main().catch((error: unknown) => {
    process.stderr.write(
        `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
});
