import type { Account } from '@jubilant-adventure/shop-domain';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createTimerJobs, delaySampler } from '../src/accounts/jobs';
import { mapAccount, toRow } from '../src/db/accounts';

const account: Account = {
    userId: '00000000-0000-4000-8000-0000000000a1',
    status: 'verified',
    profile: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        dateOfBirth: '1990-12-10',
        country: 'GB',
    },
    currency: 'GBP',
    balance: 5000,
    bonusBalance: 1000,
    bonuses: [
        {
            id: '00000000-0000-4000-8000-0000000000b1',
            code: 'WELCOME',
            amount: { amount: 1000, currency: 'GBP' },
            status: 'active',
            grantedAt: '2026-01-01T00:00:00.000Z',
            activatedAt: '2026-01-01T00:00:02.000Z',
        },
    ],
    limits: {
        dailyDeposit: 2000,
        weeklyDeposit: null,
        monthlyDeposit: 50000,
        sessionMinutes: 60,
    },
    verificationCode: '123456',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:02.000Z',
    verifiedAt: '2026-01-01T00:00:01.000Z',
};

describe('Postgres account row mapping', () => {
    test('round-trips an account through table rows', () => {
        const row = toRow(account);
        const bonusRows = account.bonuses.map((bonus) => ({
            id: bonus.id,
            userId: account.userId,
            code: bonus.code,
            amount: bonus.amount.amount,
            currency: bonus.amount.currency,
            status: bonus.status,
            grantedAt: '2026-01-01 00:00:00+00',
            activatedAt: '2026-01-01 00:00:02+00',
        }));

        const mapped = mapAccount(
            {
                ...row,
                status: account.status,
                firstName: row.firstName ?? null,
                lastName: row.lastName ?? null,
                dateOfBirth: row.dateOfBirth ?? null,
                country: row.country ?? null,
                balanceAmount: account.balance,
                bonusBalanceAmount: account.bonusBalance,
                dailyDepositLimit: row.dailyDepositLimit ?? null,
                weeklyDepositLimit: row.weeklyDepositLimit ?? null,
                monthlyDepositLimit: row.monthlyDepositLimit ?? null,
                sessionLimitMinutes: row.sessionLimitMinutes ?? null,
                verifiedAt: '2026-01-01 00:00:01+00',
                createdAt: '2026-01-01 00:00:00+00',
                updatedAt: '2026-01-01 00:00:02+00',
            },
            bonusRows,
        );

        expect(mapped).toEqual(account);
    });

    test('maps an unverified account without optional data', () => {
        const pending: Account = {
            ...account,
            status: 'pending_verification',
            profile: {
                firstName: null,
                lastName: null,
                dateOfBirth: null,
                country: null,
            },
            bonuses: [],
            verifiedAt: null,
        };
        const row = toRow(pending);

        expect(row).toMatchObject({ country: null, verifiedAt: null });
        expect(
            mapAccount(
                {
                    ...row,
                    status: pending.status,
                    firstName: null,
                    lastName: null,
                    dateOfBirth: null,
                    country: null,
                    balanceAmount: pending.balance,
                    bonusBalanceAmount: pending.bonusBalance,
                    dailyDepositLimit: 2000,
                    weeklyDepositLimit: null,
                    monthlyDepositLimit: 50000,
                    sessionLimitMinutes: 60,
                    verifiedAt: null,
                    createdAt: pending.createdAt,
                    updatedAt: pending.updatedAt,
                },
                [],
            ),
        ).toEqual(pending);
    });
});

describe('timer jobs', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    test('runs a job after its delay and reports failures', async () => {
        vi.useFakeTimers();
        const onError = vi.fn();
        const jobs = createTimerJobs(onError);
        const done = vi.fn(async () => undefined);
        const failure = new Error('job failed');

        jobs.schedule(done, 100);
        jobs.schedule(async () => {
            throw failure;
        }, 200);

        await vi.advanceTimersByTimeAsync(99);
        expect(done).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(101);
        expect(done).toHaveBeenCalledOnce();
        expect(onError).toHaveBeenCalledWith(failure);
    });

    test('samples delays within the configured range', () => {
        const sample = delaySampler({ minMs: 10, maxMs: 12 });
        for (let index = 0; index < 50; index += 1) {
            const value = sample();
            expect(value).toBeGreaterThanOrEqual(10);
            expect(value).toBeLessThanOrEqual(12);
        }
        expect(delaySampler({ minMs: 7, maxMs: 7 })()).toBe(7);
    });
});
