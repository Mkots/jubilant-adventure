import { DomainError } from '@jubilant-adventure/shop-domain';
import type { ApiRuntime } from '../app';
import { withSpan } from '../observability/telemetry';
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
    const result = await withSpan('shop.checkout', () =>
        runtime.services.orders.checkout(userId, idempotencyKey),
    );
    const gateway = runtime.paymentGateway as PaymentGateway | undefined;
    if (!gateway) {
        if (result.replayed && result.order.status === 'cancelled') {
            throw new DomainError(
                'conflict',
                'Payment for this checkout already failed',
            );
        }
        return result;
    }
    if (result.replayed && result.order.status === 'paid') return result;
    const checkout =
        result.replayed && result.order.status === 'cancelled'
            ? await runtime.services.orders.retryCancelledCheckout(
                  userId,
                  idempotencyKey,
              )
            : result;
    try {
        await gateway.authorize({
            orderId: checkout.order.id,
            amount: checkout.order.total.amount,
            currency: checkout.order.total.currency,
            idempotencyKey,
            correlationId,
            scenario,
        });
        const paid = await withSpan('shop.order.transition', () =>
            runtime.services.orders.transition(
                { userId: 'internal-payment', role: 'admin' },
                checkout.order.id,
                'paid',
            ),
        );
        return { order: paid, replayed: false };
    } catch (error) {
        if (checkout.order.status === 'pending') {
            await runtime.services.orders.cancelPendingCheckout(
                checkout.order.id,
            );
        }
        throw error;
    }
};
