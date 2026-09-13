import { createDatabase, migrateDatabase } from '../src/db/client';

const connection = createDatabase();

const main = async (): Promise<void> => {
    try {
        await migrateDatabase(connection.db);
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
