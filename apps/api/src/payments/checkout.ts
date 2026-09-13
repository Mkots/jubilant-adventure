import { DomainError } from '@jubilant-adventure/shop-domain';
import type { ApiRuntime } from '../app';
import type { PaymentGateway } from './gateway';

export const checkoutWithPayment = async (
    runtime: ApiRuntime,
    userId: string,
    idempotencyKey: string,
    correlationId: string,
    scenario?: string,
): Promise<{
    order: Awaited<
        ReturnType<ApiRuntime['services']['orders']['checkout']>
    >['order'];
    replayed: boolean;
}> => {
    const result = await runtime.services.orders.checkout(
        userId,
        idempotencyKey,
    );
    if (result.replayed && result.order.status === 'paid') return result;
    if (result.replayed && result.order.status === 'cancelled') {
        throw new DomainError(
            'conflict',
            'Payment for this checkout already failed',
        );
    }
    const gateway = runtime.paymentGateway as PaymentGateway | undefined;
    if (!gateway) return result;
    try {
        await gateway.authorize({
            orderId: result.order.id,
            amount: result.order.total.amount,
            currency: result.order.total.currency,
            idempotencyKey,
            correlationId,
            scenario,
        });
        const paid = await runtime.services.orders.transition(
            { userId: 'internal-payment', role: 'admin' },
            result.order.id,
            'paid',
        );
        return { order: paid, replayed: false };
    } catch (error) {
        if (result.order.status === 'pending') {
            await runtime.services.orders.cancelPendingCheckout(
                result.order.id,
            );
        }
        throw error;
    }
};
