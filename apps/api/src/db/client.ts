import { join } from 'node:path';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { schema } from './schema';

export type ShopDatabase = NodePgDatabase<typeof schema>;

export const requireDatabaseUrl = (
    value = process.env.DATABASE_URL,
): string => {
    if (!value?.trim()) {
        throw new Error(
            'DATABASE_URL is required for PostgreSQL mode; set it explicitly in the environment',
        );
    }
    return value;
};

export interface DatabaseConnection {
    db: ShopDatabase;
    pool: Pool;
    close: () => Promise<void>;
}

export const createDatabase = (
    databaseUrl = requireDatabaseUrl(),
): DatabaseConnection => {
    const pool = new Pool({
        connectionString: requireDatabaseUrl(databaseUrl),
    });
    const db = drizzle(pool, { schema });
    return { db, pool, close: () => pool.end() };
};

export const migrateDatabase = async (
    database: ShopDatabase,
    migrationsFolder = join(__dirname, '../../drizzle'),
): Promise<void> => {
    await migrate(database, { migrationsFolder });
};
