import { DomainError } from '@jubilant-adventure/shop-domain';
import { z } from 'zod';

export interface PaymentAuthorizationRequest {
    orderId: string;
    amount: number;
    currency: string;
    idempotencyKey: string;
    correlationId: string;
    scenario?: string;
}

export interface PaymentAuthorization {
    providerTransactionId: string;
    status: 'authorized';
}

export interface PaymentGateway {
    authorize(
        request: PaymentAuthorizationRequest,
    ): Promise<PaymentAuthorization>;
}

const successSchema = z.object({
    providerTransactionId: z.string().min(1),
    status: z.literal('authorized'),
});

const providerErrorSchema = z.object({
    error: z.object({ code: z.string(), message: z.string() }),
});

export class InMemoryPaymentGateway implements PaymentGateway {
    public async authorize(
        request: PaymentAuthorizationRequest,
    ): Promise<PaymentAuthorization> {
        return {
            providerTransactionId: `memory-${request.idempotencyKey}`,
            status: 'authorized',
        };
    }
}

export interface HttpPaymentGatewayOptions {
    baseUrl: string;
    timeoutMs?: number;
    fetchImplementation?: typeof globalThis.fetch;
}

export class HttpPaymentGateway implements PaymentGateway {
    private readonly fetchImplementation: typeof globalThis.fetch;
    private readonly timeoutMs: number;

    public constructor(private readonly options: HttpPaymentGatewayOptions) {
        this.fetchImplementation =
            options.fetchImplementation ?? globalThis.fetch;
        this.timeoutMs = options.timeoutMs ?? 800;
        if (!options.baseUrl.trim())
            throw new Error('PAYMENT_GATEWAY_URL must not be empty');
    }

    public async authorize(
        request: PaymentAuthorizationRequest,
    ): Promise<PaymentAuthorization> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const response = await this.fetchImplementation(
                `${this.options.baseUrl.replace(/\/$/, '')}/payments/authorize`,
                {
                    method: 'POST',
                    signal: controller.signal,
                    headers: {
                        accept: 'application/json',
                        'content-type': 'application/json',
                        'idempotency-key': request.idempotencyKey,
                        'x-correlation-id': request.correlationId,
                        ...(request.scenario
                            ? { 'x-payment-scenario': request.scenario }
                            : {}),
                    },
                    body: JSON.stringify({
                        orderId: request.orderId,
                        amount: request.amount,
                        currency: request.currency,
                    }),
                },
            );
            const raw: unknown = await response.json().catch(() => undefined);
            if (response.status === 402)
                throw new DomainError(
                    'payment_declined',
                    'Payment was declined',
                );
            if (response.status >= 500)
                throw new DomainError(
                    'payment_unavailable',
                    'Payment provider is unavailable',
                );
            if (!response.ok)
                throw new DomainError(
                    'payment_unavailable',
                    'Payment provider rejected the request',
                );
            const parsed = successSchema.safeParse(raw);
            if (!parsed.success)
                throw new DomainError(
                    'payment_malformed',
                    'Payment provider returned an invalid response',
                );
            return parsed.data;
        } catch (error) {
            if (error instanceof DomainError) throw error;
            if (controller.signal.aborted)
                throw new DomainError(
                    'payment_timeout',
                    'Payment provider timed out',
                );
            throw new DomainError(
                'payment_unavailable',
                'Payment provider is unavailable',
            );
        } finally {
            clearTimeout(timeout);
        }
    }
}

export const paymentGatewayFromEnvironment = (): PaymentGateway => {
    const baseUrl = process.env.PAYMENT_GATEWAY_URL;
    return baseUrl
        ? new HttpPaymentGateway({
              baseUrl,
              timeoutMs: Number(process.env.PAYMENT_TIMEOUT_MS ?? 800),
          })
        : new InMemoryPaymentGateway();
};

export const parseProviderError = (
    value: unknown,
): { code: string; message: string } | undefined => {
    const parsed = providerErrorSchema.safeParse(value);
    return parsed.success ? parsed.data.error : undefined;
};
