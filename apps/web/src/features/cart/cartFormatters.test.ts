import { describe, expect, it } from 'vitest';
import type { Product } from '../catalog/catalogApi';
import {
    formatMinorUnitMoney,
    getCartLineTotal,
    getCartTotal,
} from './cartFormatters';

const product: Product = {
    id: '00000000-0000-4000-8000-000000000101',
    name: 'Comet Mug',
    description: 'Fixture product',
    category: 'home',
    price: { amount: 1299, currency: 'USD' },
    stock: 12,
    active: true,
};

const line = {
    product,
    productId: product.id,
    quantity: 2,
};

describe('cart formatters', () => {
    it('formats integer minor units without floating point arithmetic', () => {
        expect(formatMinorUnitMoney(2598, 'USD')).toBe('$25.98');
        expect(getCartLineTotal(line)).toBe(2598);
        expect(getCartTotal([line])).toBe(2598);
    });
});
