import * as allure from 'allure-js-commons';
import { sanitizeApiExchange } from '../../scripts/allure/sanitizer';

export interface ApiResponse<T = unknown> {
    status: number;
    headers: Headers;
    body: T;
}

interface RequestOptions extends RequestInit {
    json?: unknown;
}

export interface LoginResponse {
    token: string;
    expiresIn: number;
    user: { id: string; email: string; role: 'user' | 'admin' };
}

export interface ProductListResponse {
    items: Array<{ id: string; name: string; stock: number }>;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface CartResponse {
    userId: string;
    items: Array<{ productId: string; quantity: number }>;
}

export interface OrderResponse {
    id: string;
    userId: string;
    status: string;
    idempotencyKey: string;
}

export class ApiClient {
    private token?: string;

    public constructor(
        private readonly baseUrl: string,
        private readonly controlKey = 'black-box-control',
    ) {}

    public withToken(token: string): ApiClient {
        const client = new ApiClient(this.baseUrl, this.controlKey);
        client.token = token;
        return client;
    }

    public async request<T = unknown>(
        path: string,
        options: RequestOptions = {},
    ): Promise<ApiResponse<T>> {
        const headers = new Headers(options.headers);
        if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
        if (options.json !== undefined) {
            headers.set('Content-Type', 'application/json');
        }

        const url = new URL(path, this.baseUrl);
        const response = await fetch(url, {
            ...options,
            headers,
            body:
                options.json === undefined
                    ? options.body
                    : JSON.stringify(options.json),
        });
        const contentType = response.headers.get('content-type') ?? '';
        const body = contentType.includes('application/json')
            ? await response.json()
            : await response.text();
        const result = {
            status: response.status,
            headers: response.headers,
            body,
        } as ApiResponse<T>;
        if (
            process.env.ALLURE_RESULTS_DIR &&
            (response.status >= 500 ||
                process.env.ALLURE_ATTACH_EXPECTED_FAILURES === '1')
        ) {
            await allure.attachment(
                `${options.method ?? 'GET'} ${path}`,
                JSON.stringify(
                    sanitizeApiExchange({
                        request: {
                            method: options.method ?? 'GET',
                            url: url.toString(),
                            headers: Object.fromEntries(headers.entries()),
                            body: options.json,
                        },
                        response: {
                            status: response.status,
                            headers: Object.fromEntries(
                                response.headers.entries(),
                            ),
                            body,
                        },
                    }),
                    null,
                    2,
                ),
                { contentType: 'application/json' },
            );
        }
        return result;
    }

    public async login(
        email: string,
        password: string,
    ): Promise<ApiResponse<LoginResponse>> {
        const response = await allureStep('Login', () =>
            this.request<LoginResponse>('/auth/login', {
                method: 'POST',
                json: { email, password },
            }),
        );
        if (response.status === 200) this.token = response.body.token;
        return response;
    }

    public products(query = ''): Promise<ApiResponse<ProductListResponse>> {
        return allureStep('List products', () =>
            this.request(`/products${query}`),
        );
    }

    public reset(): Promise<ApiResponse> {
        return allureStep('Reset test fixture', () =>
            this.request('/__test/reset', {
                method: 'POST',
                headers: { 'X-Test-Control-Key': this.controlKey },
            }),
        );
    }

    public seed(scenario: 'baseline' | 'low-stock'): Promise<ApiResponse> {
        return allureStep(`Seed ${scenario} fixture`, () =>
            this.request('/__test/seed', {
                method: 'POST',
                headers: { 'X-Test-Control-Key': this.controlKey },
                json: { scenario, version: 'v1' },
            }),
        );
    }

    public addCartItem(
        productId: string,
        quantity: number,
    ): Promise<ApiResponse<CartResponse>> {
        return allureStep('Update cart', () =>
            this.request('/cart/items', {
                method: 'POST',
                json: { productId, quantity },
            }),
        );
    }

    public checkout(
        idempotencyKey: string,
    ): Promise<ApiResponse<{ order: OrderResponse; replayed: boolean }>> {
        return allureStep('Checkout cart', () =>
            this.request('/orders', {
                method: 'POST',
                headers: { 'Idempotency-Key': idempotencyKey },
            }),
        );
    }

    public getOrder(id: string): Promise<ApiResponse<OrderResponse>> {
        return allureStep('Read order', () => this.request(`/orders/${id}`));
    }

    public updateOrderStatus(
        id: string,
        status: string,
    ): Promise<ApiResponse<OrderResponse>> {
        return allureStep(`Transition order to ${status}`, () =>
            this.request(`/orders/${id}/status`, {
                method: 'PATCH',
                json: { status },
            }),
        );
    }
}

const allureStep = <T>(name: string, action: () => Promise<T>): Promise<T> =>
    process.env.ALLURE_RESULTS_DIR
        ? Promise.resolve(allure.step(name, action))
        : action();
