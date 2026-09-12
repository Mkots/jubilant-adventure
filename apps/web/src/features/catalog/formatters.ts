import type { Product } from './catalogApi';

export const formatPrice = (product: Product): string =>
    new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: product.price.currency,
    }).format(product.price.amount / 100);

export const formatStock = (stock: number): string => {
    if (stock === 0) return 'Out of stock';
    if (stock <= 3) return `Only ${stock} left`;
    return `${stock} in stock`;
};

export const getApiErrorMessage = (
    error: unknown,
    fallback = 'We could not load the catalog.',
): string => {
    if (!error || typeof error !== 'object') return fallback;
    const data = 'data' in error ? error.data : undefined;
    if (data && typeof data === 'object' && 'message' in data) {
        const message = data.message;
        if (typeof message === 'string' && message.length > 0) return message;
    }
    return fallback;
};
