import { fixtureIds } from '@jubilant-adventure/test-data';
import { type APIRequestContext, expect } from '@playwright/test';
import { ShopPage } from '../pages/shop.page';
import { test as base } from './test';

const apiBaseURL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:3412';
const controlKey = process.env.E2E_TEST_CONTROL_KEY ?? 'e2e-control';

interface LoginResponse {
    token: string;
}

interface Order {
    id: string;
    status: string;
}

interface CheckoutResponse {
    order: Order;
    replayed: boolean;
}

export class E2EControl {
    constructor(
        private readonly request: APIRequestContext,
        readonly baseURL = apiBaseURL,
    ) {}

    async seed(scenario: 'baseline' | 'low-stock' = 'baseline'): Promise<void> {
        const response = await this.request.post(
            `${this.baseURL}/__test/seed`,
            {
                headers: { 'X-Test-Control-Key': controlKey },
                data: { scenario, version: 'v1' },
            },
        );
        await expect(response).toBeOK();
    }

    async login(email: string): Promise<string> {
        const response = await this.request.post(`${this.baseURL}/auth/login`, {
            data: { email, password: 'password' },
        });
        await expect(response).toBeOK();
        const body = (await response.json()) as LoginResponse;
        return body.token;
    }

    async createOrder(
        email: string,
        idempotencyKey: string,
    ): Promise<{ token: string; order: Order }> {
        const token = await this.login(email);
        const authorization = { Authorization: `Bearer ${token}` };
        const cartResponse = await this.request.post(
            `${this.baseURL}/cart/items`,
            {
                headers: authorization,
                data: { productId: fixtureIds.mug, quantity: 1 },
            },
        );
        await expect(cartResponse).toBeOK();
        const checkoutResponse = await this.request.post(
            `${this.baseURL}/orders`,
            {
                headers: {
                    ...authorization,
                    'Idempotency-Key': idempotencyKey,
                },
            },
        );
        expect(checkoutResponse.status()).toBe(201);
        const body = (await checkoutResponse.json()) as CheckoutResponse;
        return { token, order: body.order };
    }
}

type Fixtures = {
    control: E2EControl;
    shopPage: ShopPage;
};

export const test = base.extend<Fixtures>({
    control: async ({ request }, use) => {
        await use(new E2EControl(request));
    },
    shopPage: async ({ page }, use) => {
        await use(new ShopPage(page));
    },
});

export { expect };
