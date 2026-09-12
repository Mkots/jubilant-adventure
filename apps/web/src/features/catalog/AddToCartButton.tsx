import { useState } from 'react';
import type { Product } from './catalogApi';

interface AddToCartButtonProps {
    product: Product;
}

export const AddToCartButton = ({
    product,
}: AddToCartButtonProps): React.ReactNode => {
    const [added, setAdded] = useState(false);
    const unavailable = product.stock === 0;

    return (
        <div className="cart-entry">
            <button
                className="button"
                disabled={unavailable}
                onClick={() => setAdded(true)}
                type="button"
            >
                {unavailable ? 'Out of stock' : 'Add to cart'}
            </button>
            {added && (
                <span aria-live="polite" className="action-confirmation">
                    Added to cart
                </span>
            )}
        </div>
    );
};
