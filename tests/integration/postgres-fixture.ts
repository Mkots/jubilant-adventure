import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import type { AsyncShopRepositories } from '@jubilant-adventure/shop-domain';
import {
    PostgreSqlContainer,
    type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import {
    createDatabase,
    type DatabaseConnection,
    migrateDatabase,
} from '../../apps/api/src/db/client';
import { createPostgresRepositories } from '../../apps/api/src/db/repositories';
import { safePath } from '../../scripts/lib/safe-env.mjs';

export interface PostgresFixture {
    container: StartedPostgreSqlContainer;
    connection: DatabaseConnection;
    repositories: AsyncShopRepositories;
}

export const startPostgresFixture = async (): Promise<PostgresFixture> => {
    if (!process.env.DOCKER_HOST) {
        try {
            process.env.DOCKER_HOST = execFileSync(
                'docker',
                [
                    'context',
                    'inspect',
                    '--format',
                    '{{.Endpoints.docker.Host}}',
                ],
                { encoding: 'utf8', env: { ...process.env, PATH: safePath() } },
            ).trim();
            if (process.env.DOCKER_HOST.includes('.colima/')) {
                process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';
            }
        } catch {
            // Testcontainers will produce the actionable prerequisite error below.
        }
    }
    let container: StartedPostgreSqlContainer | undefined;
    let connection: DatabaseConnection | undefined;
    try {
        const password =
            process.env.POSTGRES_PASSWORD ?? randomBytes(24).toString('hex');
        container = await new PostgreSqlContainer('postgres:16.4-alpine')
            .withDatabase('jubilant_adventure')
            .withUsername('jubilant')
            .withPassword(password)
            .start();
        connection = createDatabase(container.getConnectionUri());
        await migrateDatabase(connection.db);
        return {
            container,
            connection,
            repositories: createPostgresRepositories(connection.db),
        };
    } catch (error) {
        await connection?.close().catch(() => undefined);
        await container?.stop().catch(() => undefined);
        const message = error instanceof Error ? error.message : String(error);
        if (process.env.CI) {
            await mkdir('artifacts', { recursive: true });
            await writeFile(
                'artifacts/postgres-fixture-error.txt',
                `${message}\n`,
                'utf8',
            );
        }
        throw new Error(
            `PostgreSQL integration prerequisite failed. Start Docker or Podman and retry. ${message}`,
        );
    }
};

export const stopPostgresFixture = async (
    fixture: PostgresFixture | undefined,
): Promise<void> => {
    await fixture?.connection.close().catch(() => undefined);
    await fixture?.container.stop().catch(() => undefined);
};
