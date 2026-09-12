import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    type CartLine,
    useAddCartItemMutation,
    useGetCartQuery,
} from '../features/cart/cartApi';
import {
    formatMinorUnitMoney,
    getCartLineTotal,
    getCartTotal,
} from '../features/cart/cartFormatters';
import { getApiErrorMessage } from '../features/catalog/formatters';
import { useAppSelector } from '../store/hooks';

const QuantityEditor = ({ line }: { line: CartLine }): React.ReactNode => {
    const [quantity, setQuantity] = useState(String(line.quantity));
    const [updateCart, updateState] = useAddCartItemMutation();

    useEffect(() => setQuantity(String(line.quantity)), [line.quantity]);

    const submit = async (): Promise<void> => {
        const nextQuantity = Number(quantity);
        if (!Number.isInteger(nextQuantity) || nextQuantity < 1) return;
        await updateCart({
            product: line.product,
            productId: line.productId,
            quantity: nextQuantity,
        });
    };

    return (
        <div className="quantity-editor">
            <label>
                Quantity for {line.product.name}
                <input
                    aria-label={`Quantity for ${line.product.name}`}
                    min="1"
                    max={line.product.stock}
                    onChange={(event) => setQuantity(event.target.value)}
                    type="number"
                    value={quantity}
                />
            </label>
            <button
                className="button button--secondary"
                disabled={updateState.isLoading}
                onClick={() => void submit()}
                type="button"
            >
                Update
            </button>
            {updateState.isError && (
                <span className="field-error" role="alert">
                    {getApiErrorMessage(
                        updateState.error,
                        'Quantity could not be updated.',
                    )}
                </span>
            )}
        </div>
    );
};

export const CartPage = (): React.ReactNode => {
    const token = useAppSelector((state) => state.session.token);
    const {
        data: cart,
        isError,
        isLoading,
    } = useGetCartQuery(undefined, {
        skip: !token,
    });

    if (!token) {
        return (
            <section className="cart-page" aria-labelledby="cart-title">
                <p className="eyebrow">Cart</p>
                <h1 id="cart-title">Sign in to view your cart</h1>
                <p>
                    Your cart is tied to your account so it is ready at
                    checkout.
                </p>
                <Link className="button" to="/login">
                    Sign in
                </Link>
            </section>
        );
    }

    if (isLoading) {
        return (
            <div aria-busy="true" className="catalog-state">
                Loading your cart...
            </div>
        );
    }

    if (isError || !cart) {
        return (
            <section
                className="catalog-state catalog-state--error"
                role="alert"
            >
                <h1>Cart unavailable</h1>
                <p>We could not load your cart. Try again from the catalog.</p>
                <Link className="button" to="/">
                    Back to catalog
                </Link>
            </section>
        );
    }

    if (cart.items.length === 0) {
        return (
            <section className="cart-page" aria-labelledby="cart-title">
                <p className="eyebrow">Cart</p>
                <h1 id="cart-title">Your cart is empty</h1>
                <p>Add products from the catalog to start an order.</p>
                <Link className="button" to="/">
                    Browse products
                </Link>
            </section>
        );
    }

    const currency = cart.items[0].product.price.currency;
    const total = getCartTotal(cart.items);

    return (
        <section className="cart-page" aria-labelledby="cart-title">
            <p className="eyebrow">Cart</p>
            <h1 id="cart-title">Review your order</h1>
            <ul className="cart-list" aria-label="Cart items">
                {cart.items.map((line) => (
                    <li className="cart-line" key={line.productId}>
                        <div>
                            <h2>{line.product.name}</h2>
                            <p>
                                {formatMinorUnitMoney(
                                    line.product.price.amount,
                                    line.product.price.currency,
                                )}{' '}
                                each
                            </p>
                        </div>
                        <QuantityEditor line={line} />
                        <strong>
                            {formatMinorUnitMoney(
                                getCartLineTotal(line),
                                line.product.price.currency,
                            )}
                        </strong>
                    </li>
                ))}
            </ul>
            <div className="cart-summary">
                <span>Total</span>
                <strong>{formatMinorUnitMoney(total, currency)}</strong>
            </div>
            <Link className="button" to="/checkout">
                Continue to checkout
            </Link>
        </section>
    );
};
