import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    type CheckoutResponse,
    useCheckoutMutation,
} from '../features/cart/cartApi';
import { getApiErrorMessage } from '../features/catalog/formatters';
import { useAppSelector } from '../store/hooks';

const newIdempotencyKey = (): string =>
    `checkout-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;

export const CheckoutPage = (): React.ReactNode => {
    const token = useAppSelector((state) => state.session.token);
    const defaultEmail = useAppSelector(
        (state) => state.session.user?.email ?? '',
    );
    const [email, setEmail] = useState(defaultEmail);
    const [validationError, setValidationError] = useState('');
    const [result, setResult] = useState<CheckoutResponse | null>(null);
    const attemptKey = useRef<string | null>(null);
    const validationRef = useRef<HTMLDivElement>(null);
    const [checkout, checkoutState] = useCheckoutMutation();

    useEffect(() => {
        if (validationError) validationRef.current?.focus();
    }, [validationError]);

    if (!token) {
        return (
            <section className="checkout-page" aria-labelledby="checkout-title">
                <p className="eyebrow">Checkout</p>
                <h1 id="checkout-title">Sign in before checkout</h1>
                <Link className="button" to="/login">
                    Sign in
                </Link>
            </section>
        );
    }

    if (result) {
        return (
            <section
                className="checkout-page"
                aria-labelledby="confirmation-title"
            >
                <p className="eyebrow">Order confirmed</p>
                <h1 id="confirmation-title">Thanks for your order</h1>
                <p>
                    Order <strong>{result.order.id}</strong> is{' '}
                    {result.order.status}.
                </p>
                {result.replayed && (
                    <p>
                        This was a safe replay of the original checkout attempt.
                    </p>
                )}
                <Link className="button" to="/orders">
                    View orders
                </Link>
            </section>
        );
    }

    const submit = async (
        event: React.FormEvent<HTMLFormElement>,
    ): Promise<void> => {
        event.preventDefault();
        if (!email.trim()) {
            setValidationError('Email is required.');
            return;
        }
        setValidationError('');
        attemptKey.current ??= newIdempotencyKey();
        try {
            const response = await checkout({
                idempotencyKey: attemptKey.current,
            }).unwrap();
            setResult(response);
            attemptKey.current = null;
        } catch {
            // Keep the key so retry reuses the same checkout attempt.
        }
    };

    return (
        <section className="checkout-page" aria-labelledby="checkout-title">
            <p className="eyebrow">Checkout</p>
            <h1 id="checkout-title">Complete your order</h1>
            <form className="checkout-form" onSubmit={submit}>
                <label>
                    Email for order updates
                    <input
                        aria-invalid={Boolean(validationError)}
                        autoComplete="email"
                        onChange={(event) => setEmail(event.target.value)}
                        type="email"
                        value={email}
                    />
                </label>
                {validationError && (
                    <div
                        className="field-error"
                        ref={validationRef}
                        role="alert"
                        tabIndex={-1}
                    >
                        {validationError}
                    </div>
                )}
                {checkoutState.isError && (
                    <div className="checkout-error" role="alert">
                        <strong>Checkout was not completed.</strong>
                        <p>
                            {getApiErrorMessage(
                                checkoutState.error,
                                'The server could not complete this order.',
                            )}
                        </p>
                        <p>
                            Your cart was kept. You can retry this same attempt.
                        </p>
                    </div>
                )}
                <button
                    className="button"
                    disabled={checkoutState.isLoading}
                    type="submit"
                >
                    {checkoutState.isLoading ? 'Submitting...' : 'Place order'}
                </button>
            </form>
        </section>
    );
};
