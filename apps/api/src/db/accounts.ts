import type {
    Account,
    AccountStore,
    AsyncUserRepository,
} from '@jubilant-adventure/shop-domain';
import { conflict } from '@jubilant-adventure/shop-domain';
import { asc, eq } from 'drizzle-orm';
import type { ShopDatabase } from './client';
import { userAccounts, userBonuses, users } from './schema';

type AccountRow = typeof userAccounts.$inferSelect;
type BonusRow = typeof userBonuses.$inferSelect;

export const mapAccount = (row: AccountRow, bonuses: BonusRow[]): Account => ({
    userId: row.userId,
    status: row.status,
    profile: {
        firstName: row.firstName,
        lastName: row.lastName,
        dateOfBirth: row.dateOfBirth,
        country: row.country,
    },
    currency: row.currency,
    balance: row.balanceAmount,
    bonusBalance: row.bonusBalanceAmount,
    bonuses: bonuses.map((bonus) => ({
        id: bonus.id,
        code: bonus.code,
        amount: { amount: bonus.amount, currency: bonus.currency },
        status: bonus.status,
        grantedAt: new Date(bonus.grantedAt).toISOString(),
        activatedAt: bonus.activatedAt
            ? new Date(bonus.activatedAt).toISOString()
            : null,
    })),
    limits: {
        dailyDeposit: row.dailyDepositLimit,
        weeklyDeposit: row.weeklyDepositLimit,
        monthlyDeposit: row.monthlyDepositLimit,
        sessionMinutes: row.sessionLimitMinutes,
    },
    verificationCode: row.verificationCode,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    verifiedAt: row.verifiedAt ? new Date(row.verifiedAt).toISOString() : null,
});

export const toRow = (account: Account): typeof userAccounts.$inferInsert => ({
    userId: account.userId,
    status: account.status,
    firstName: account.profile.firstName,
    lastName: account.profile.lastName,
    dateOfBirth: account.profile.dateOfBirth,
    country: account.profile.country,
    currency: account.currency,
    balanceAmount: account.balance,
    bonusBalanceAmount: account.bonusBalance,
    dailyDepositLimit: account.limits.dailyDeposit,
    weeklyDepositLimit: account.limits.weeklyDeposit,
    monthlyDepositLimit: account.limits.monthlyDeposit,
    sessionLimitMinutes: account.limits.sessionMinutes,
    verificationCode: account.verificationCode,
    verifiedAt: account.verifiedAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
});

const isUniqueViolation = (error: unknown): boolean =>
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505';

const readAccount = async (
    db: ShopDatabase,
    userId: string,
    lock: boolean,
): Promise<Account | undefined> => {
    const query = db
        .select()
        .from(userAccounts)
        .where(eq(userAccounts.userId, userId))
        .limit(1);
    const rows = lock ? await query.for('update') : await query;
    const row = rows[0];
    if (!row) return undefined;
    const bonuses = await db
        .select()
        .from(userBonuses)
        .where(eq(userBonuses.userId, userId))
        .orderBy(asc(userBonuses.grantedAt), asc(userBonuses.id));
    return mapAccount(row, bonuses);
};

const writeAccount = async (
    db: ShopDatabase,
    account: Account,
): Promise<void> => {
    const row = toRow(account);
    await db
        .insert(userAccounts)
        .values(row)
        .onConflictDoUpdate({ target: userAccounts.userId, set: row });
    await db.delete(userBonuses).where(eq(userBonuses.userId, account.userId));
    if (account.bonuses.length > 0) {
        await db.insert(userBonuses).values(
            account.bonuses.map((bonus) => ({
                id: bonus.id,
                userId: account.userId,
                code: bonus.code,
                amount: bonus.amount.amount,
                currency: bonus.amount.currency,
                status: bonus.status,
                grantedAt: bonus.grantedAt,
                activatedAt: bonus.activatedAt,
            })),
        );
    }
};

export const createPostgresAccountStore = (
    db: ShopDatabase,
    userRepository: AsyncUserRepository,
): AccountStore => ({
    getUserById: (id) => userRepository.getById(id),
    getUserByEmail: (email) => userRepository.getByEmail(email),
    register: async (user, account) => {
        try {
            await db.transaction(async (transaction) => {
                const tx = transaction as unknown as ShopDatabase;
                await tx.insert(users).values({
                    id: user.id,
                    email: user.email,
                    passwordHash: user.passwordHash,
                    role: user.role,
                });
                await writeAccount(tx, account);
            });
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw conflict('A user with this email already exists');
            }
            throw error;
        }
    },
    get: (userId) => readAccount(db, userId, false),
    insertIfMissing: async (account) => {
        await db
            .insert(userAccounts)
            .values(toRow(account))
            .onConflictDoNothing();
    },
    update: (userId, mutate) =>
        db.transaction(async (transaction) => {
            const tx = transaction as unknown as ShopDatabase;
            const current = await readAccount(tx, userId, true);
            if (!current) return undefined;
            const next = mutate(current);
            if (next !== current) await writeAccount(tx, next);
            return next;
        }),
    clear: async () => {
        await db.delete(userBonuses);
        await db.delete(userAccounts);
    },
});
