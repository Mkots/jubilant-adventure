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

        const response = await fetch(new URL(path, this.baseUrl), {
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
        return {
            status: response.status,
            headers: response.headers,
            body,
        } as ApiResponse<T>;
    }

    public async login(
        email: string,
        password: string,
    ): Promise<ApiResponse<LoginResponse>> {
        const response = await this.request<LoginResponse>('/auth/login', {
            method: 'POST',
            json: { email, password },
        });
        if (response.status === 200) this.token = response.body.token;
        return response;
    }

    public products(query = ''): Promise<ApiResponse<ProductListResponse>> {
        return this.request(`/products${query}`);
    }

    public reset(): Promise<ApiResponse> {
        return this.request('/__test/reset', {
            method: 'POST',
            headers: { 'X-Test-Control-Key': this.controlKey },
        });
    }

    public seed(scenario: 'baseline' | 'low-stock'): Promise<ApiResponse> {
        return this.request('/__test/seed', {
            method: 'POST',
            headers: { 'X-Test-Control-Key': this.controlKey },
            json: { scenario, version: 'v1' },
        });
    }

    public addCartItem(
        productId: string,
        quantity: number,
    ): Promise<ApiResponse<CartResponse>> {
        return this.request('/cart/items', {
            method: 'POST',
            json: { productId, quantity },
        });
    }

    public checkout(
        idempotencyKey: string,
    ): Promise<ApiResponse<{ order: OrderResponse; replayed: boolean }>> {
        return this.request('/orders', {
            method: 'POST',
            headers: { 'Idempotency-Key': idempotencyKey },
        });
    }

    public getOrder(id: string): Promise<ApiResponse<OrderResponse>> {
        return this.request(`/orders/${id}`);
    }

    public updateOrderStatus(
        id: string,
        status: string,
    ): Promise<ApiResponse<OrderResponse>> {
        return this.request(`/orders/${id}/status`, {
            method: 'PATCH',
            json: { status },
        });
    }
}
