import { conflict, forbidden, invalidInput, notFound } from './errors';
import type { Actor, ShopClock, UserRepository } from './repositories';
import type { Money, Role, User } from './types';

export type AccountStatus = 'pending_verification' | 'verifying' | 'verified';

export type BonusStatus = 'pending' | 'active';

export interface AccountProfile {
    firstName: string | null;
    lastName: string | null;
    dateOfBirth: string | null;
    country: string | null;
}

/** Responsible-gaming limits. Amounts are minor units of the account currency. */
export interface AccountLimits {
    dailyDeposit: number | null;
    weeklyDeposit: number | null;
    monthlyDeposit: number | null;
    sessionMinutes: number | null;
}

export interface Bonus {
    id: string;
    code: string;
    amount: Money;
    status: BonusStatus;
    grantedAt: string;
    activatedAt: string | null;
}

export interface Account {
    userId: string;
    status: AccountStatus;
    profile: AccountProfile;
    currency: string;
    balance: number;
    bonusBalance: number;
    bonuses: Bonus[];
    limits: AccountLimits;
    verificationCode: string;
    createdAt: string;
    updatedAt: string;
    verifiedAt: string | null;
}

/** Public projection returned by the HTTP API. Never contains secrets. */
export interface UserAccountView {
    id: string;
    email: string;
    role: Role;
    status: AccountStatus;
    profile: AccountProfile;
    currency: string;
    balance: Money;
    bonusBalance: Money;
    bonuses: Bonus[];
    limits: AccountLimits;
    createdAt: string;
    verifiedAt: string | null;
}

export interface RegistrationInput {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    country?: string;
    currency?: string;
}

export interface BonusInput {
    code: string;
    amount: number;
}

export interface AccountStore {
    getUserById(id: string): Promise<User | undefined>;
    getUserByEmail(email: string): Promise<User | undefined>;
    /** Persists the user and its account atomically. Throws `conflict` on a duplicate email. */
    register(user: User, account: Account): Promise<void>;
    get(userId: string): Promise<Account | undefined>;
    insertIfMissing(account: Account): Promise<void>;
    /**
     * Applies `mutate` to the stored account without lost updates.
     * Returns `undefined` when the account no longer exists.
     */
    update(
        userId: string,
        mutate: (account: Account) => Account,
    ): Promise<Account | undefined>;
    clear(): Promise<void>;
}

export interface PasswordHasher {
    hash(password: string): string | Promise<string>;
}

export interface BackgroundJobs {
    schedule(job: () => Promise<void>, delayMs: number): void;
}

export interface AccountServiceDependencies {
    store: AccountStore;
    clock: ShopClock;
    passwordHasher: PasswordHasher;
    jobs: BackgroundJobs;
    /** How long simulated backend processing (verification, bonus activation) takes. */
    processingDelayMs?: () => number;
    newId?: () => string;
    newVerificationCode?: () => string;
}

export const defaultAccountCurrency = 'USD';
export const minimumPlayerAge = 18;

const emptyLimits = (): AccountLimits => ({
    dailyDeposit: null,
    weeklyDeposit: null,
    monthlyDeposit: null,
    sessionMinutes: null,
});

const verificationCodeRange = 1_000_000;
// Largest multiple of the range that fits in a uint32; values at or above it
// are rejected so every code is equally likely (no modulo bias).
const unbiasedLimit =
    Math.floor(2 ** 32 / verificationCodeRange) * verificationCodeRange;

const randomVerificationCode = (): string => {
    const buffer = new Uint32Array(1);
    let value: number;
    do {
        [value = unbiasedLimit] = globalThis.crypto.getRandomValues(buffer);
    } while (value >= unbiasedLimit);
    return (value % verificationCodeRange).toString().padStart(6, '0');
};

const isAdult = (dateOfBirth: string, now: Date): boolean => {
    const [year, month, day] = dateOfBirth.split('-').map(Number);
    if (!year || !month || !day) return false;
    const adulthood = Date.UTC(year + minimumPlayerAge, month - 1, day);
    return adulthood <= now.getTime();
};

const assertLimitOrder = (limits: AccountLimits): void => {
    const ordered: Array<[keyof AccountLimits, keyof AccountLimits]> = [
        ['dailyDeposit', 'weeklyDeposit'],
        ['weeklyDeposit', 'monthlyDeposit'],
        ['dailyDeposit', 'monthlyDeposit'],
    ];
    for (const [shorter, longer] of ordered) {
        const shorterValue = limits[shorter];
        const longerValue = limits[longer];
        if (
            shorterValue !== null &&
            longerValue !== null &&
            shorterValue > longerValue
        ) {
            throw invalidInput('Deposit limits are inconsistent', {
                [shorter]: `must not exceed ${longer}`,
            });
        }
    }
};

const requireVerified = (account: Account): void => {
    if (account.status !== 'verified') {
        throw conflict('The account must be verified first');
    }
};

export class AccountService {
    private readonly store: AccountStore;
    private readonly clock: ShopClock;
    private readonly passwordHasher: PasswordHasher;
    private readonly jobs: BackgroundJobs;
    private readonly processingDelayMs: () => number;
    private readonly newId: () => string;
    private readonly newVerificationCode: () => string;

    public constructor(dependencies: AccountServiceDependencies) {
        this.store = dependencies.store;
        this.clock = dependencies.clock;
        this.passwordHasher = dependencies.passwordHasher;
        this.jobs = dependencies.jobs;
        this.processingDelayMs = dependencies.processingDelayMs ?? (() => 0);
        this.newId =
            dependencies.newId ?? (() => globalThis.crypto.randomUUID());
        this.newVerificationCode =
            dependencies.newVerificationCode ?? randomVerificationCode;
    }

    public async register(input: RegistrationInput): Promise<UserAccountView> {
        const email = input.email.trim().toLowerCase();
        const now = this.clock.now();
        if (input.dateOfBirth && !isAdult(input.dateOfBirth, now)) {
            throw invalidInput('The user is too young to register', {
                dateOfBirth: `must be at least ${minimumPlayerAge} years ago`,
            });
        }
        if (await this.store.getUserByEmail(email)) {
            throw conflict('A user with this email already exists');
        }
        const timestamp = now.toISOString();
        const user: User = {
            id: this.newId(),
            email,
            passwordHash: await this.passwordHasher.hash(input.password),
            role: 'user',
        };
        const account: Account = {
            userId: user.id,
            status: 'pending_verification',
            profile: {
                firstName: input.firstName ?? null,
                lastName: input.lastName ?? null,
                dateOfBirth: input.dateOfBirth ?? null,
                country: input.country ?? null,
            },
            currency: input.currency ?? defaultAccountCurrency,
            balance: 0,
            bonusBalance: 0,
            bonuses: [],
            limits: emptyLimits(),
            verificationCode: this.newVerificationCode(),
            createdAt: timestamp,
            updatedAt: timestamp,
            verifiedAt: null,
        };
        await this.store.register(user, account);
        return this.view(user, account);
    }

    public async get(actor: Actor, userId: string): Promise<UserAccountView> {
        this.authorizeSelfOrAdmin(actor, userId);
        const { user, account } = await this.load(userId);
        return this.view(user, account);
    }

    /**
     * Starts verification. A user confirms with the emailed code; an admin
     * may approve without one. Completion happens asynchronously.
     */
    public async startVerification(
        actor: Actor,
        userId: string,
        code?: string,
    ): Promise<UserAccountView> {
        this.authorizeSelfOrAdmin(actor, userId);
        const { user } = await this.load(userId);
        const outcome = { started: false };
        const account = await this.mutate(userId, (current) => {
            if (current.status !== 'pending_verification') return current;
            if (actor.role !== 'admin' && code !== current.verificationCode) {
                throw invalidInput('The verification code is invalid', {
                    code: 'does not match the code sent to the user',
                });
            }
            outcome.started = true;
            return { ...current, status: 'verifying' };
        });
        if (outcome.started) {
            this.jobs.schedule(
                () => this.completeVerification(userId),
                this.processingDelayMs(),
            );
        }
        return this.view(user, account);
    }

    public async completeVerification(userId: string): Promise<void> {
        await this.store.update(userId, (current) =>
            current.status === 'verifying'
                ? {
                      ...current,
                      status: 'verified',
                      verifiedAt: this.timestamp(),
                  }
                : current,
        );
    }

    public async verificationCode(userId: string): Promise<string> {
        const { account } = await this.load(userId);
        return account.verificationCode;
    }

    public async setBalance(
        actor: Actor,
        userId: string,
        amount: number,
    ): Promise<UserAccountView> {
        this.requireAdmin(actor);
        const { user } = await this.load(userId);
        const account = await this.mutate(userId, (current) => {
            requireVerified(current);
            return { ...current, balance: amount };
        });
        return this.view(user, account);
    }

    /** Grants a bonus in `pending` status; it becomes `active` asynchronously. */
    public async grantBonus(
        actor: Actor,
        userId: string,
        input: BonusInput,
    ): Promise<Bonus> {
        this.requireAdmin(actor);
        const { account } = await this.load(userId);
        const bonus: Bonus = {
            id: this.newId(),
            code: input.code,
            amount: { amount: input.amount, currency: account.currency },
            status: 'pending',
            grantedAt: this.timestamp(),
            activatedAt: null,
        };
        await this.mutate(userId, (current) => {
            requireVerified(current);
            return { ...current, bonuses: [...current.bonuses, bonus] };
        });
        this.jobs.schedule(
            () => this.activateBonus(userId, bonus.id),
            this.processingDelayMs(),
        );
        return { ...bonus, amount: { ...bonus.amount } };
    }

    public async activateBonus(userId: string, bonusId: string): Promise<void> {
        await this.store.update(userId, (current) => {
            const bonus = current.bonuses.find((item) => item.id === bonusId);
            if (bonus?.status !== 'pending') return current;
            return {
                ...current,
                bonusBalance: current.bonusBalance + bonus.amount.amount,
                bonuses: current.bonuses.map((item) =>
                    item.id === bonusId
                        ? {
                              ...item,
                              status: 'active',
                              activatedAt: this.timestamp(),
                          }
                        : item,
                ),
            };
        });
    }

    public async setLimits(
        actor: Actor,
        userId: string,
        limits: AccountLimits,
    ): Promise<UserAccountView> {
        this.authorizeSelfOrAdmin(actor, userId);
        assertLimitOrder(limits);
        const { user } = await this.load(userId);
        const account = await this.mutate(userId, (current) => ({
            ...current,
            limits: { ...limits },
        }));
        return this.view(user, account);
    }

    private authorizeSelfOrAdmin(actor: Actor, userId: string): void {
        if (actor.role !== 'admin' && actor.userId !== userId) {
            throw forbidden('You cannot access this user');
        }
    }

    private requireAdmin(actor: Actor): void {
        if (actor.role !== 'admin') {
            throw forbidden('Only admins can perform this operation');
        }
    }

    /**
     * Loads the user and account. Users that exist without an account record
     * (fixture users) receive a verified account with an empty balance.
     */
    private async load(
        userId: string,
    ): Promise<{ user: User; account: Account }> {
        const user = await this.store.getUserById(userId);
        if (!user) throw notFound('User');
        const existing = await this.store.get(userId);
        if (existing) return { user, account: existing };
        const timestamp = this.timestamp();
        await this.store.insertIfMissing({
            userId,
            status: 'verified',
            profile: {
                firstName: null,
                lastName: null,
                dateOfBirth: null,
                country: null,
            },
            currency: defaultAccountCurrency,
            balance: 0,
            bonusBalance: 0,
            bonuses: [],
            limits: emptyLimits(),
            verificationCode: this.newVerificationCode(),
            createdAt: timestamp,
            updatedAt: timestamp,
            verifiedAt: timestamp,
        });
        const account = await this.store.get(userId);
        if (!account) throw notFound('User');
        return { user, account };
    }

    private async mutate(
        userId: string,
        mutate: (account: Account) => Account,
    ): Promise<Account> {
        const timestamp = this.timestamp();
        const account = await this.store.update(userId, (current) => {
            const next = mutate(current);
            return next === current
                ? current
                : { ...next, updatedAt: timestamp };
        });
        if (!account) throw notFound('User');
        return account;
    }

    private timestamp(): string {
        return this.clock.now().toISOString();
    }

    private view(user: User, account: Account): UserAccountView {
        return {
            id: user.id,
            email: user.email,
            role: user.role,
            status: account.status,
            profile: { ...account.profile },
            currency: account.currency,
            balance: { amount: account.balance, currency: account.currency },
            bonusBalance: {
                amount: account.bonusBalance,
                currency: account.currency,
            },
            bonuses: account.bonuses.map((bonus) => ({
                ...bonus,
                amount: { ...bonus.amount },
            })),
            limits: { ...account.limits },
            createdAt: account.createdAt,
            verifiedAt: account.verifiedAt,
        };
    }
}

const clone = <T>(value: T): T => structuredClone(value);

/**
 * In-memory store backed by the shop's synchronous user repository, so
 * registered users can log in through the existing auth service.
 */
export interface InMemoryAccountStore extends AccountStore {
    /** Synchronous variant of `clear` for the synchronous in-memory runtime. */
    reset(): void;
}

export const createInMemoryAccountStore = (
    users: UserRepository,
): InMemoryAccountStore => {
    const accounts = new Map<string, Account>();
    return {
        getUserById: async (id) => users.getById(id),
        getUserByEmail: async (email) => users.getByEmail(email),
        register: async (user, account) => {
            if (users.getByEmail(user.email)) {
                throw conflict('A user with this email already exists');
            }
            users.save(user);
            accounts.set(account.userId, clone(account));
        },
        get: async (userId) => {
            const account = accounts.get(userId);
            return account ? clone(account) : undefined;
        },
        insertIfMissing: async (account) => {
            if (!accounts.has(account.userId)) {
                accounts.set(account.userId, clone(account));
            }
        },
        update: async (userId, mutate) => {
            const current = accounts.get(userId);
            if (!current) return undefined;
            const next = mutate(clone(current));
            accounts.set(userId, clone(next));
            return clone(next);
        },
        clear: async () => {
            accounts.clear();
        },
        reset: () => {
            accounts.clear();
        },
    };
};
