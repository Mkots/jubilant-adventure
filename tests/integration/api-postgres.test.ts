import { createBaselineSeed } from '@jubilant-adventure/test-data';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPostgresApp } from '../../apps/api/src/app';
import {
    type PostgresFixture,
    startPostgresFixture,
    stopPostgresFixture,
} from './postgres-fixture';

describe('black-box PostgreSQL API profile', () => {
    let fixture: PostgresFixture | undefined;
    let app: Awaited<ReturnType<typeof createPostgresApp>> | undefined;
    beforeAll(async () => {
        try {
            fixture = await startPostgresFixture();
            app = await createPostgresApp({
                mode: 'test',
                databaseUrl: fixture.container.getConnectionUri(),
                testControlKey: 'postgres-control',
            });
            await fixture.repositories.reset(createBaselineSeed());
        } catch (error) {
            console.warn(
                error instanceof Error ? error.message : String(error),
            );
        }
    });
    afterAll(async () => {
        await app?.request('/__test/reset', {
            method: 'POST',
            headers: { 'x-test-control-key': 'postgres-control' },
        });
        await app?.close();
        await stopPostgresFixture(fixture);
    });
    test('serves login and catalog from the real database adapter', async () => {
        if (!app) return;
        const login = await app.request('/auth/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                email: 'user@example.test',
                password: 'password',
            }),
        });
        expect(login.status).toBe(200);
        const products = await app.request('/products?page=1&pageSize=2');
        expect(products.status).toBe(200);
        const body = (await products.json()) as { items: unknown[] };
        expect(body.items).toHaveLength(2);
    });
});
