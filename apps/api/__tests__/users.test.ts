import type { OpenAPIHono } from '@hono/zod-openapi';
import type { BackgroundJobs } from '@jubilant-adventure/shop-domain';
import { beforeEach, describe, expect, test } from 'vitest';
import { type AppEnv, createApp } from '../src/app';

/** Collects delayed jobs so tests decide when "the backend" finishes. */
const createManualJobs = () => {
    const queue: Array<() => Promise<void>> = [];
    const jobs: BackgroundJobs = {
        schedule: (job) => {
            queue.push(job);
        },
    };
    const runAll = async (): Promise<void> => {
        while (queue.length > 0) {
            await queue.shift()?.();
        }
    };
    return { jobs, queue, runAll };
};

interface UserAccountBody {
    id: string;
    email: string;
    role: string;
    status: string;
    currency: string;
    balance: { amount: number; currency: string };
    bonusBalance: { amount: number; currency: string };
    bonuses: Array<{ id: string; status: string; code: string }>;
    limits: Record<string, number | null>;
    verifiedAt: string | null;
}

const controlKey = 'users-control-key';

let app: OpenAPIHono<AppEnv>;
let manual: ReturnType<typeof createManualJobs>;

const json = (method: string, body: unknown, token?: string): RequestInit => ({
    method,
    headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
});

const login = async (email: string, password: string): Promise<string> => {
    const response = await app.request(
        '/auth/login',
        json('POST', { email, password }),
    );
    expect(response.status).toBe(200);
    return ((await response.json()) as { token: string }).token;
};

const register = async (
    overrides: Record<string, unknown> = {},
): Promise<UserAccountBody> => {
    const response = await app.request(
        '/users',
        json('POST', {
            email: 'new.player@example.test',
            password: 'correct-horse',
            firstName: 'New',
            lastName: 'Player',
            dateOfBirth: '1990-05-17',
            country: 'DE',
            currency: 'EUR',
            ...overrides,
        }),
    );
    expect(response.status).toBe(201);
    return (await response.json()) as UserAccountBody;
};

const getUser = async (id: string, token: string) => {
    const response = await app.request(`/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return {
        status: response.status,
        body: (await response.json()) as UserAccountBody,
    };
};

beforeEach(() => {
    manual = createManualJobs();
    app = createApp({
        mode: 'test',
        testControlKey: controlKey,
        accountJobs: manual.jobs,
    });
});

describe('user account API', () => {
    test('registers a user who can log in and read their own account', async () => {
        const created = await register();
        expect(created).toMatchObject({
            email: 'new.player@example.test',
            role: 'user',
            status: 'pending_verification',
            currency: 'EUR',
            balance: { amount: 0, currency: 'EUR' },
            bonuses: [],
            verifiedAt: null,
        });
        expect(JSON.stringify(created)).not.toContain('verificationCode');

        const token = await login('New.Player@example.test', 'correct-horse');
        const me = await app.request('/users/me', {
            headers: { Authorization: `Bearer ${token}` },
        });
        expect(me.status).toBe(200);
        expect(((await me.json()) as UserAccountBody).id).toBe(created.id);

        const duplicate = await app.request(
            '/users',
            json('POST', {
                email: 'NEW.PLAYER@example.test',
                password: 'another-password',
            }),
        );
        expect(duplicate.status).toBe(409);
    });

    test('rejects invalid registrations', async () => {
        const tooYoung = await app.request(
            '/users',
            json('POST', {
                email: 'kid@example.test',
                password: 'password1',
                dateOfBirth: '2015-01-01',
            }),
        );
        expect(tooYoung.status).toBe(400);

        const shortPassword = await app.request(
            '/users',
            json('POST', { email: 'short@example.test', password: 'short' }),
        );
        expect(shortPassword.status).toBe(400);
    });

    test('verifies with the emailed code asynchronously', async () => {
        const created = await register();
        const token = await login('new.player@example.test', 'correct-horse');

        const wrongCode = await app.request(
            `/users/${created.id}/verification`,
            json('POST', { code: '000000x' }, token),
        );
        expect(wrongCode.status).toBe(400);

        const missingKey = await app.request(
            `/__test/users/${created.id}/verification-code`,
        );
        expect(missingKey.status).toBe(401);
        const codeResponse = await app.request(
            `/__test/users/${created.id}/verification-code`,
            { headers: { 'X-Test-Control-Key': controlKey } },
        );
        expect(codeResponse.status).toBe(200);
        const { code } = (await codeResponse.json()) as { code: string };
        expect(code).toMatch(/^\d{6}$/);

        const started = await app.request(
            `/users/${created.id}/verification`,
            json('POST', { code }, token),
        );
        expect(started.status).toBe(202);
        expect(((await started.json()) as UserAccountBody).status).toBe(
            'verifying',
        );
        expect((await getUser(created.id, token)).body.status).toBe(
            'verifying',
        );

        await manual.runAll();

        const verified = await getUser(created.id, token);
        expect(verified.body.status).toBe('verified');
        expect(verified.body.verifiedAt).not.toBeNull();

        const again = await app.request(
            `/users/${created.id}/verification`,
            json('POST', { code }, token),
        );
        expect(again.status).toBe(200);
        expect(manual.queue).toHaveLength(0);
    });

    test('lets an admin bring a user to a defined state', async () => {
        const created = await register();
        const admin = await login('admin@example.test', 'password');

        const balanceBeforeVerification = await app.request(
            `/users/${created.id}/balance`,
            json('PUT', { amount: 5000 }, admin),
        );
        expect(balanceBeforeVerification.status).toBe(409);

        const verification = await app.request(
            `/users/${created.id}/verification`,
            { method: 'POST', headers: { Authorization: `Bearer ${admin}` } },
        );
        expect(verification.status).toBe(202);
        await manual.runAll();

        const balance = await app.request(
            `/users/${created.id}/balance`,
            json('PUT', { amount: 5000 }, admin),
        );
        expect(balance.status).toBe(200);
        expect(((await balance.json()) as UserAccountBody).balance).toEqual({
            amount: 5000,
            currency: 'EUR',
        });

        const bonus = await app.request(
            `/users/${created.id}/bonuses`,
            json('POST', { code: 'WELCOME100', amount: 1000 }, admin),
        );
        expect(bonus.status).toBe(202);
        expect(await bonus.json()).toMatchObject({
            code: 'WELCOME100',
            status: 'pending',
            amount: { amount: 1000, currency: 'EUR' },
            activatedAt: null,
        });
        const pending = await getUser(created.id, admin);
        expect(pending.body.bonusBalance.amount).toBe(0);

        await manual.runAll();

        const active = await getUser(created.id, admin);
        expect(active.body.bonuses).toMatchObject([
            { code: 'WELCOME100', status: 'active' },
        ]);
        expect(active.body.bonusBalance).toEqual({
            amount: 1000,
            currency: 'EUR',
        });

        const limits = await app.request(
            `/users/${created.id}/limits`,
            json(
                'PUT',
                {
                    dailyDeposit: 2000,
                    weeklyDeposit: 10000,
                    sessionMinutes: 60,
                },
                admin,
            ),
        );
        expect(limits.status).toBe(200);
        expect(((await limits.json()) as UserAccountBody).limits).toEqual({
            dailyDeposit: 2000,
            weeklyDeposit: 10000,
            monthlyDeposit: null,
            sessionMinutes: 60,
        });
    });

    test('enforces ownership and admin-only operations', async () => {
        const created = await register();
        const owner = await login('new.player@example.test', 'correct-horse');
        const otherUser = await login('user@example.test', 'password');

        expect((await getUser(created.id, otherUser)).status).toBe(403);
        const noAuth = await app.request(`/users/${created.id}`);
        expect(noAuth.status).toBe(401);

        const selfBalance = await app.request(
            `/users/${created.id}/balance`,
            json('PUT', { amount: 1 }, owner),
        );
        expect(selfBalance.status).toBe(403);
        const selfBonus = await app.request(
            `/users/${created.id}/bonuses`,
            json('POST', { code: 'FREE', amount: 1 }, owner),
        );
        expect(selfBonus.status).toBe(403);
        const selfVerifyWithoutCode = await app.request(
            `/users/${created.id}/verification`,
            json('POST', {}, owner),
        );
        expect(selfVerifyWithoutCode.status).toBe(400);

        const selfLimits = await app.request(
            `/users/${created.id}/limits`,
            json('PUT', { dailyDeposit: 100 }, owner),
        );
        expect(selfLimits.status).toBe(200);

        const inconsistent = await app.request(
            `/users/${created.id}/limits`,
            json('PUT', { dailyDeposit: 5000, weeklyDeposit: 100 }, owner),
        );
        expect(inconsistent.status).toBe(400);

        const admin = await login('admin@example.test', 'password');
        const missing = await getUser(
            '00000000-0000-4000-8000-00000000ffff',
            admin,
        );
        expect(missing.status).toBe(404);
        const malformed = await app.request('/users/not-a-uuid', {
            headers: { Authorization: `Bearer ${admin}` },
        });
        expect(malformed.status).toBe(400);
    });

    test('gives fixture users a verified default account', async () => {
        const token = await login('user@example.test', 'password');
        const me = await app.request('/users/me', {
            headers: { Authorization: `Bearer ${token}` },
        });
        expect(me.status).toBe(200);
        expect(await me.json()).toMatchObject({
            email: 'user@example.test',
            status: 'verified',
            currency: 'USD',
        });
    });

    test('reset removes registered users and their accounts', async () => {
        const created = await register();
        const reset = await app.request('/__test/reset', {
            method: 'POST',
            headers: { 'X-Test-Control-Key': controlKey },
        });
        expect(reset.status).toBe(200);

        const loginAfterReset = await app.request(
            '/auth/login',
            json('POST', {
                email: 'new.player@example.test',
                password: 'correct-horse',
            }),
        );
        expect(loginAfterReset.status).toBe(401);
        const admin = await login('admin@example.test', 'password');
        expect((await getUser(created.id, admin)).status).toBe(404);
    });
});

describe('account processing delay', () => {
    test('parses a fixed delay or a jitter range', async () => {
        const { defaultProcessingDelay, parseProcessingDelay } = await import(
            '../src/accounts/jobs'
        );
        expect(parseProcessingDelay(undefined)).toBe(defaultProcessingDelay);
        expect(parseProcessingDelay('0')).toEqual({ minMs: 0, maxMs: 0 });
        expect(parseProcessingDelay('200-800')).toEqual({
            minMs: 200,
            maxMs: 800,
        });
        expect(() => parseProcessingDelay('800-200')).toThrow();
        expect(() => parseProcessingDelay('soon')).toThrow();
    });
});
