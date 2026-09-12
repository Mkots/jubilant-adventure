import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AddToCartButton } from '../features/catalog/AddToCartButton';
import {
    type Product,
    useGetProductsQuery,
} from '../features/catalog/catalogApi';
import {
    formatPrice,
    formatStock,
    getApiErrorMessage,
} from '../features/catalog/formatters';
import {
    type CatalogQueryState,
    defaultCatalogQuery,
    parseCatalogQuery,
    toCatalogSearchParams,
    toProductQuery,
} from '../features/catalog/queryState';

const sortLabels = {
    name: 'Name',
    price: 'Price',
    stock: 'Stock',
} as const;

const ProductCard = ({ product }: { product: Product }): React.ReactNode => (
    <li className="product-card">
        <div className="product-card__body">
            <p className="eyebrow">{product.category}</p>
            <h2>
                <Link to={`/products/${product.id}`}>{product.name}</Link>
            </h2>
            <p className="product-description">{product.description}</p>
            <div className="product-meta">
                <strong>{formatPrice(product)}</strong>
                <span>{formatStock(product.stock)}</span>
            </div>
        </div>
        <AddToCartButton product={product} />
    </li>
);

export const ProductsPage = (): React.ReactNode => {
    const [searchParams, setSearchParams] = useSearchParams();
    const query = useMemo(
        () => parseCatalogQuery(searchParams),
        [searchParams],
    );
    const [draftSearch, setDraftSearch] = useState(query.search ?? '');
    const { data, error, isError, isFetching, isLoading, refetch } =
        useGetProductsQuery(toProductQuery(query));

    useEffect(() => {
        setDraftSearch(query.search ?? '');
    }, [query.search]);

    const updateQuery = (changes: Partial<CatalogQueryState>): void => {
        const shouldResetPage =
            'search' in changes ||
            'category' in changes ||
            'sort' in changes ||
            'direction' in changes;
        const nextQuery = {
            ...query,
            ...changes,
            ...(shouldResetPage ? { page: 1 } : {}),
        };
        setSearchParams(toCatalogSearchParams(nextQuery), { replace: true });
    };

    const categories = Array.from(
        new Set([
            ...(query.category ? [query.category] : []),
            ...(data?.items.map((product) => product.category) ?? []),
        ]),
    ).sort();

    return (
        <section aria-labelledby="catalog-title" className="catalog-page">
            <div className="catalog-heading">
                <div>
                    <p className="eyebrow">Catalog</p>
                    <h1 id="catalog-title">Find your next favorite</h1>
                    <p className="catalog-intro">
                        Browse practical tools and small comforts for focused
                        work.
                    </p>
                </div>
                <p className="catalog-count">
                    {data ? `${data.total} products` : 'Product catalog'}
                </p>
            </div>

            <form
                className="catalog-controls"
                onSubmit={(event) => {
                    event.preventDefault();
                    updateQuery({ search: draftSearch.trim() || undefined });
                }}
            >
                <label>
                    Search products
                    <input
                        name="search"
                        onChange={(event) => setDraftSearch(event.target.value)}
                        placeholder="Search by name or description"
                        type="search"
                        value={draftSearch}
                    />
                </label>
                <label>
                    Category
                    <select
                        aria-label="Category"
                        onChange={(event) =>
                            updateQuery({
                                category: event.target.value || undefined,
                            })
                        }
                        value={query.category ?? ''}
                    >
                        <option value="">All categories</option>
                        {categories.map((category) => (
                            <option key={category} value={category}>
                                {category}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Sort by
                    <select
                        aria-label="Sort by"
                        onChange={(event) =>
                            updateQuery({
                                sort: event.target
                                    .value as CatalogQueryState['sort'],
                            })
                        }
                        value={query.sort ?? defaultCatalogQuery.sort}
                    >
                        {Object.entries(sortLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Direction
                    <select
                        aria-label="Direction"
                        onChange={(event) =>
                            updateQuery({
                                direction: event.target
                                    .value as CatalogQueryState['direction'],
                            })
                        }
                        value={query.direction ?? defaultCatalogQuery.direction}
                    >
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                    </select>
                </label>
                <button className="button" type="submit">
                    Search
                </button>
            </form>

            <div aria-live="polite" className="sr-only">
                {isLoading ? 'Loading products' : ''}
            </div>
            {isFetching && data && (
                <p className="refresh-note" aria-hidden="true">
                    Updating results...
                </p>
            )}

            {isLoading && (
                <div aria-busy="true" className="catalog-state">
                    <p>Loading products...</p>
                </div>
            )}

            {isError && (
                <div
                    className="catalog-state catalog-state--error"
                    role="alert"
                >
                    <h2>Catalog unavailable</h2>
                    <p>{getApiErrorMessage(error)}</p>
                    <button
                        className="button"
                        onClick={() => refetch()}
                        type="button"
                    >
                        Try again
                    </button>
                </div>
            )}

            {!isLoading && !isError && data?.items.length === 0 && (
                <div className="catalog-state">
                    <h2>No products found</h2>
                    <p>Try a different search or clear one of the filters.</p>
                    <button
                        className="button button--secondary"
                        onClick={() => {
                            setDraftSearch('');
                            updateQuery({
                                search: undefined,
                                category: undefined,
                            });
                        }}
                        type="button"
                    >
                        Clear filters
                    </button>
                </div>
            )}

            {!isLoading && !isError && data && data.items.length > 0 && (
                <>
                    <ul aria-label="Product results" className="product-list">
                        {data.items.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </ul>
                    <nav aria-label="Catalog pagination" className="pagination">
                        <button
                            className="button button--secondary"
                            disabled={query.page <= 1}
                            onClick={() =>
                                updateQuery({ page: query.page - 1 })
                            }
                            type="button"
                        >
                            Previous
                        </button>
                        <span>
                            Page {data.page} of {Math.max(data.totalPages, 1)}
                        </span>
                        <button
                            className="button button--secondary"
                            disabled={
                                data.totalPages === 0 ||
                                query.page >= data.totalPages
                            }
                            onClick={() =>
                                updateQuery({ page: query.page + 1 })
                            }
                            type="button"
                        >
                            Next
                        </button>
                    </nav>
                </>
            )}
        </section>
    );
};
