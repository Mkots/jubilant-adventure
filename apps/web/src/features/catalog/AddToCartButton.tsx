import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { useAddCartItemMutation } from '../cart/cartApi';
import type { Product } from './catalogApi';
import { getApiErrorMessage } from './formatters';

interface AddToCartButtonProps {
    product: Product;
}

export const AddToCartButton = ({
    product,
}: AddToCartButtonProps): React.ReactNode => {
    const [added, setAdded] = useState(false);
    const [authRequired, setAuthRequired] = useState(false);
    const [addCartItem, addState] = useAddCartItemMutation();
    const token = useAppSelector((state) => state.session.token);
    const unavailable = product.stock === 0;

    const add = async (): Promise<void> => {
        if (!token) {
            setAuthRequired(true);
            return;
        }
        try {
            await addCartItem({
                product,
                productId: product.id,
                quantity: 1,
            }).unwrap();
            setAdded(true);
            setAuthRequired(false);
        } catch {
            setAdded(false);
        }
    };

    return (
        <div className="cart-entry">
            <button
                className="button"
                disabled={unavailable || addState.isLoading}
                onClick={() => void add()}
                type="button"
            >
                {unavailable ? 'Out of stock' : 'Add to cart'}
            </button>
            {added && (
                <span aria-live="polite" className="action-confirmation">
                    Added to cart
                </span>
            )}
            {authRequired && (
                <span className="action-error" role="alert">
                    <Link to="/login">Sign in to add items</Link>
                </span>
            )}
            {addState.isError && !authRequired && (
                <span className="action-error" role="alert">
                    {getApiErrorMessage(
                        addState.error,
                        'Could not update your cart.',
                    )}
                </span>
            )}
        </div>
    );
};
