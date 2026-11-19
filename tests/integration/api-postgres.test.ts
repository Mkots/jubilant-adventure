import type { BackgroundJobs } from '@jubilant-adventure/shop-domain';
import { createBaselineSeed } from '@jubilant-adventure/test-data';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createPostgresApp } from '../../apps/api/src/app';
import {
    type PostgresFixture,
    startPostgresFixture,
    stopPostgresFixture,
} from './postgres-fixture';

const pendingJobs: Array<() => Promise<void>> = [];
const manualJobs: BackgroundJobs = {
    schedule: (job) => {
        pendingJobs.push(job);
    },
};
const runPendingJobs = async (): Promise<void> => {
    while (pendingJobs.length > 0) await pendingJobs.shift()?.();
};

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
                accountJobs: manualJobs,
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
    test('serves login and catalog from the real database adapter', async (context) => {
        if (!app) {
            context.skip('PostgreSQL fixture is unavailable');
            return;
        }
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

    test('brings a registered user to a defined state', async (context) => {
        if (!app) {
            context.skip('PostgreSQL fixture is unavailable');
            return;
        }
        const api = app;
        const call = async (
            method: string,
            path: string,
            token?: string,
            body?: unknown,
        ) => {
            const response = await api.request(path, {
                method,
                headers: {
                    'content-type': 'application/json',
                    ...(token ? { authorization: `Bearer ${token}` } : {}),
                },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            });
            return {
                status: response.status,
                body: (await response.json()) as Record<string, unknown>,
            };
        };
        const login = async (email: string, password: string) =>
            (await call('POST', '/auth/login', undefined, { email, password }))
                .body.token as string;

        const created = await call('POST', '/users', undefined, {
            email: 'pg.player@example.test',
            password: 'correct-horse',
            country: 'DE',
            currency: 'EUR',
        });
        expect(created.status).toBe(201);
        const id = created.body.id as string;
        const duplicate = await call('POST', '/users', undefined, {
            email: 'PG.Player@example.test',
            password: 'correct-horse',
        });
        expect(duplicate.status).toBe(409);

        const owner = await login('pg.player@example.test', 'correct-horse');
        const codeResponse = await api.request(
            `/__test/users/${id}/verification-code`,
            { headers: { 'x-test-control-key': 'postgres-control' } },
        );
        const { code } = (await codeResponse.json()) as { code: string };
        const verification = await call(
            'POST',
            `/users/${id}/verification`,
            owner,
            { code },
        );
        expect(verification.status).toBe(202);
        await runPendingJobs();

        const admin = await login('admin@example.test', 'password');
        expect(
            (await call('PUT', `/users/${id}/balance`, admin, { amount: 5000 }))
                .status,
        ).toBe(200);
        expect(
            (
                await call('POST', `/users/${id}/bonuses`, admin, {
                    code: 'WELCOME',
                    amount: 1000,
                })
            ).status,
        ).toBe(202);
        await runPendingJobs();
        expect(
            (
                await call('PUT', `/users/${id}/limits`, owner, {
                    dailyDeposit: 2000,
                    sessionMinutes: 60,
                })
            ).status,
        ).toBe(200);

        const state = await call('GET', '/users/me', owner);
        expect(state.body).toMatchObject({
            id,
            status: 'verified',
            profile: { country: 'DE' },
            balance: { amount: 5000, currency: 'EUR' },
            bonusBalance: { amount: 1000, currency: 'EUR' },
            bonuses: [{ code: 'WELCOME', status: 'active' }],
            limits: {
                dailyDeposit: 2000,
                weeklyDeposit: null,
                monthlyDeposit: null,
                sessionMinutes: 60,
            },
        });

        const fixtureUser = await login('user@example.test', 'password');
        expect(
            (await call('GET', '/users/me', fixtureUser)).body,
        ).toMatchObject({ status: 'verified', currency: 'USD' });
    });
});
