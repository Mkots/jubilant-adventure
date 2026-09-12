import type {
    PasswordVerifier,
    Product,
    ShopSeed,
    User,
} from '@jubilant-adventure/shop-domain';

export const fixtureVersion = 'v1';

export const fixtureIds = {
    user: '00000000-0000-4000-8000-000000000001',
    admin: '00000000-0000-4000-8000-000000000002',
    mug: '00000000-0000-4000-8000-000000000101',
    notebook: '00000000-0000-4000-8000-000000000102',
    keyboard: '00000000-0000-4000-8000-000000000103',
} as const;

const users = (): User[] => [
    {
        id: fixtureIds.user,
        email: 'user@example.test',
        passwordHash: 'fixture:password',
        role: 'user',
    },
    {
        id: fixtureIds.admin,
        email: 'admin@example.test',
        passwordHash: 'fixture:password',
        role: 'admin',
    },
];

const products = (): Product[] => [
    {
        id: fixtureIds.mug,
        name: 'Comet Mug',
        description: 'A durable ceramic mug for long coding sessions.',
        category: 'home',
        price: { amount: 1299, currency: 'USD' },
        stock: 12,
        active: true,
    },
    {
        id: fixtureIds.notebook,
        name: 'Orbit Notebook',
        description:
            'A lined notebook for test ideas and implementation notes.',
        category: 'stationery',
        price: { amount: 899, currency: 'USD' },
        stock: 20,
        active: true,
    },
    {
        id: fixtureIds.keyboard,
        name: 'Signal Keyboard',
        description: 'A compact mechanical keyboard with a quiet switch.',
        category: 'hardware',
        price: { amount: 7999, currency: 'USD' },
        stock: 3,
        active: true,
    },
];

export const createBaselineSeed = (): ShopSeed => ({
    users: users(),
    products: products(),
    carts: [],
    orders: [],
});

export type FixtureScenario = 'baseline' | 'low-stock';

export const createScenarioSeed = (
    scenario: FixtureScenario,
    version = fixtureVersion,
): ShopSeed => {
    if (version !== fixtureVersion) {
        throw new Error(`Unsupported fixture version: ${version}`);
    }
    const seed = createBaselineSeed();
    if (scenario === 'low-stock') {
        const keyboard = seed.products.find(
            (product) => product.id === fixtureIds.keyboard,
        );
        if (keyboard) {
            keyboard.stock = 1;
        }
    }
    return seed;
};

export const fixturePasswordVerifier: PasswordVerifier = {
    verify: (password, passwordHash) => passwordHash === `fixture:${password}`,
};

export const publicFixtureSnapshot = (seed: ShopSeed): string =>
    JSON.stringify({
        users: seed.users.map(
            ({ passwordHash: _passwordHash, ...user }) => user,
        ),
        products: seed.products,
        carts: seed.carts,
        orders: seed.orders,
    });
