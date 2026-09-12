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

export const getApiErrorStatus = (error: unknown): number | undefined => {
    if (!error || typeof error !== 'object' || !('status' in error)) {
        return undefined;
    }
    const status = error.status;
    return typeof status === 'number' ? status : undefined;
};

export const getApiErrorFields = (
    error: unknown,
): Record<string, string> | undefined => {
    if (!error || typeof error !== 'object' || !('data' in error)) {
        return undefined;
    }
    const data = error.data;
    if (
        !data ||
        typeof data !== 'object' ||
        !('fields' in data) ||
        !data.fields ||
        typeof data.fields !== 'object'
    ) {
        return undefined;
    }
    return Object.fromEntries(
        Object.entries(data.fields).filter(
            ([, value]) => typeof value === 'string',
        ),
    );
};
