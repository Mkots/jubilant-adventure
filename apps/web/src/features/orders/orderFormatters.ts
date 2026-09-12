import type { Order } from './ordersApi';

export const allowedOrderTransitions: Record<
    Order['status'],
    Order['status'][]
> = {
    pending: ['paid', 'cancelled'],
    paid: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: [],
    cancelled: [],
};

export const formatOrderMoney = (order: Order): string =>
    new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: order.total.currency,
    }).format(order.total.amount / 100);

export const formatOrderDate = (value: string): string =>
    new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
