import { Link, useParams } from 'react-router-dom';
import { AddToCartButton } from '../features/catalog/AddToCartButton';
import { useGetProductQuery } from '../features/catalog/catalogApi';
import {
    formatPrice,
    formatStock,
    getApiErrorMessage,
} from '../features/catalog/formatters';

export const ProductDetailPage = (): React.ReactNode => {
    const { id = '' } = useParams();
    const {
        data: product,
        error,
        isError,
        isLoading,
        refetch,
    } = useGetProductQuery(id, { skip: !id });

    if (isLoading) {
        return (
            <section aria-busy="true" className="catalog-state">
                <p>Loading product...</p>
            </section>
        );
    }

    if (isError || !product) {
        return (
            <section
                className="catalog-state catalog-state--error"
                role="alert"
            >
                <h1>Product unavailable</h1>
                <p>
                    {getApiErrorMessage(
                        error,
                        'This product could not be found.',
                    )}
                </p>
                <div className="detail-actions">
                    <button
                        className="button"
                        onClick={() => refetch()}
                        type="button"
                    >
                        Try again
                    </button>
                    <Link className="button button--secondary" to="/">
                        Back to catalog
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <article aria-labelledby="product-title" className="product-detail">
            <Link className="back-link" to="/">
                Back to catalog
            </Link>
            <p className="eyebrow">{product.category}</p>
            <h1 id="product-title">{product.name}</h1>
            <p className="product-detail__description">{product.description}</p>
            <dl className="product-detail__facts">
                <div>
                    <dt>Price</dt>
                    <dd>{formatPrice(product)}</dd>
                </div>
                <div>
                    <dt>Availability</dt>
                    <dd>{formatStock(product.stock)}</dd>
                </div>
            </dl>
            <AddToCartButton product={product} />
        </article>
    );
};
