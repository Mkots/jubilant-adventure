import type { CartLine } from './cartApi';

export const formatMinorUnitMoney = (
    amount: number,
    currency: string,
): string =>
    new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
    }).format(amount / 100);

export const getCartLineTotal = (line: CartLine): number =>
    line.product.price.amount * line.quantity;

export const getCartTotal = (lines: CartLine[]): number =>
    lines.reduce((total, line) => total + getCartLineTotal(line), 0);
