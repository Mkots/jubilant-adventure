import type { paths } from '@jubilant-adventure/api-client';
import { HttpResponse, http } from 'msw';

type ProductList =
    paths['/products']['get']['responses'][200]['content']['application/json'];
type Product = ProductList['items'][number];
type ErrorResponse =
    paths['/auth/login']['post']['responses'][401]['content']['application/json'];

export const fixtureProduct: Product = {
    id: '00000000-0000-4000-8000-000000000101',
    name: 'Comet Mug',
    description: 'A durable ceramic mug for long coding sessions.',
    category: 'home',
    price: { amount: 1299, currency: 'USD' },
    stock: 12,
    active: true,
};

export const productsResponse: ProductList = {
    items: [fixtureProduct],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
};

export const apiUrl = (path: string): string => {
    const origin =
        import.meta.env.VITE_API_ORIGIN ??
        (typeof window === 'undefined'
            ? 'http://api.test/api'
            : `${window.location.origin}/api`);
    return new URL(path.replace(/^\//, ''), `${origin}/`).toString();
};

export const errorResponse = (
    code: string,
    message: string,
    fields?: Record<string, string>,
): ErrorResponse => ({
    code,
    message,
    ...(fields ? { fields } : {}),
});

export const handlers = [
    http.get(apiUrl('/products'), () => HttpResponse.json(productsResponse)),
    http.get(apiUrl(`/products/${fixtureProduct.id}`), () =>
        HttpResponse.json(fixtureProduct),
    ),
];
