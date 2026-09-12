import { HttpResponse, http } from 'msw';
import type { CartView, CheckoutResponse } from '../../features/cart/cartApi';
import type { Order } from '../../features/orders/ordersApi';
import type { SessionState } from '../../store/sessionSlice';
import {
    apiUrl,
    errorResponse,
    fixtureProduct,
    productsResponse,
} from './handlers';

export const storyUserSession: SessionState = {
    token: 'storybook-user-token',
    user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'user@example.test',
        role: 'user',
    },
};

export const storyAdminSession: SessionState = {
    token: 'storybook-admin-token',
    user: {
        id: '00000000-0000-4000-8000-000000000002',
        email: 'admin@example.test',
        role: 'admin',
    },
};

export const longProduct = {
    ...fixtureProduct,
    name: `${'A very carefully named '.repeat(5)}Desk Lamp`,
    description:
        'A deliberately long product description used to keep the catalog and detail actions readable at narrow widths without hiding the important information or controls.',
};

export const storyOrder: Order = {
    id: '00000000-0000-4000-8000-000000000501',
    userId: storyUserSession.user?.id ?? '',
    idempotencyKey: 'storybook-checkout',
    items: [
        {
            productId: fixtureProduct.id,
            name: fixtureProduct.name,
            unitPrice: fixtureProduct.price,
            quantity: 1,
            total: fixtureProduct.price,
        },
    ],
    total: fixtureProduct.price,
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
};

export const longOrder: Order = {
    ...storyOrder,
    items: [
        {
            ...storyOrder.items[0],
            name: `${'A product with a name that remains readable '.repeat(4)}Lamp`,
        },
    ],
};

export const storyCart: CartView = {
    userId: storyUserSession.user?.id ?? '',
    items: [
        {
            product: fixtureProduct,
            productId: fixtureProduct.id,
            quantity: 1,
        },
    ],
};

export const storyCheckoutResponse: CheckoutResponse = {
    order: storyOrder,
    replayed: false,
};

const neverResolves = async (): Promise<never> =>
    new Promise<never>(() => undefined);

export const catalogStoryHandlers = {
    default: http.get(apiUrl('/products'), () =>
        HttpResponse.json(productsResponse),
    ),
    loading: http.get(apiUrl('/products'), neverResolves),
    empty: http.get(apiUrl('/products'), () =>
        HttpResponse.json({
            ...productsResponse,
            items: [],
            total: 0,
            totalPages: 0,
        }),
    ),
    error: http.get(apiUrl('/products'), () =>
        HttpResponse.json(
            errorResponse('internal_error', 'Catalog is offline'),
            {
                status: 500,
            },
        ),
    ),
    longContent: http.get(apiUrl('/products'), () =>
        HttpResponse.json({
            ...productsResponse,
            items: [longProduct],
        }),
    ),
};

export const productDetailStoryHandlers = {
    default: http.get(apiUrl(`/products/${fixtureProduct.id}`), () =>
        HttpResponse.json(fixtureProduct),
    ),
    loading: http.get(apiUrl(`/products/${fixtureProduct.id}`), neverResolves),
    error: http.get(apiUrl(`/products/${fixtureProduct.id}`), () =>
        HttpResponse.json(errorResponse('not_found', 'Product not found'), {
            status: 404,
        }),
    ),
    longContent: http.get(apiUrl(`/products/${fixtureProduct.id}`), () =>
        HttpResponse.json(longProduct),
    ),
};

export const cartStoryHandlers = {
    default: http.get(apiUrl('/cart'), () => HttpResponse.json(storyCart)),
    empty: http.get(apiUrl('/cart'), () =>
        HttpResponse.json({ ...storyCart, items: [] }),
    ),
    loading: http.get(apiUrl('/cart'), neverResolves),
    error: http.get(apiUrl('/cart'), () =>
        HttpResponse.json(errorResponse('internal_error', 'Cart is offline'), {
            status: 500,
        }),
    ),
    update: http.post(apiUrl('/cart/items'), async ({ request }) => {
        const item = (await request.json()) as {
            productId: string;
            quantity: number;
        };
        return HttpResponse.json({
            userId: storyCart.userId,
            items: [item],
        });
    }),
    longContent: http.get(apiUrl('/cart'), () =>
        HttpResponse.json({
            ...storyCart,
            items: [
                {
                    ...storyCart.items[0],
                    product: longProduct,
                },
            ],
        }),
    ),
};

export const checkoutStoryHandlers = {
    success: http.post(apiUrl('/orders'), () =>
        HttpResponse.json(storyCheckoutResponse, { status: 201 }),
    ),
    loading: http.post(apiUrl('/orders'), neverResolves),
    error: http.post(apiUrl('/orders'), () =>
        HttpResponse.json(
            errorResponse('internal_error', 'Checkout is offline'),
            {
                status: 500,
            },
        ),
    ),
};

export const loginStoryHandlers = {
    success: http.post(apiUrl('/auth/login'), () =>
        HttpResponse.json({
            token: storyUserSession.token,
            expiresIn: 900,
            user: storyUserSession.user,
        }),
    ),
    loading: http.post(apiUrl('/auth/login'), neverResolves),
    invalidCredentials: http.post(apiUrl('/auth/login'), () =>
        HttpResponse.json(
            errorResponse('invalid_credentials', 'Invalid email or password', {
                email: 'Use your account email',
            }),
            { status: 401 },
        ),
    ),
};

export const orderStoryHandlers = {
    default: http.get(apiUrl(`/orders/${storyOrder.id}`), () =>
        HttpResponse.json(storyOrder),
    ),
    loading: http.get(apiUrl(`/orders/${storyOrder.id}`), neverResolves),
    forbidden: http.get(apiUrl(`/orders/${storyOrder.id}`), () =>
        HttpResponse.json(errorResponse('forbidden', 'Order access denied'), {
            status: 403,
        }),
    ),
    expired: http.get(apiUrl(`/orders/${storyOrder.id}`), () =>
        HttpResponse.json(
            errorResponse('unauthorized', 'Authentication is required'),
            { status: 401 },
        ),
    ),
    longContent: http.get(apiUrl(`/orders/${storyOrder.id}`), () =>
        HttpResponse.json(longOrder),
    ),
    adminUpdate: http.patch(apiUrl(`/orders/${storyOrder.id}/status`), () =>
        HttpResponse.json({ ...storyOrder, status: 'paid' }),
    ),
};
