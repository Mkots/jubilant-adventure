import type { paths } from '@jubilant-adventure/api-client';
import type { ReactNode } from 'react';
import { baseApi } from '../store/api';

type ProductList =
    paths['/products']['get']['responses'][200]['content']['application/json'];

const harnessApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        getProductsForHarness: build.query<ProductList, void>({
            query: () => '/products',
        }),
    }),
});

export const NetworkProbe = (): ReactNode => {
    const { data, error, isError, isLoading, refetch } =
        harnessApi.useGetProductsForHarnessQuery();

    if (isLoading) return <p role="status">Loading products...</p>;
    if (isError) {
        const dataValue =
            typeof error === 'object' && error && 'data' in error
                ? error.data
                : undefined;
        const message =
            typeof dataValue === 'object' && dataValue && 'message' in dataValue
                ? String(dataValue.message)
                : 'Unable to load products';
        return <p role="alert">{message}</p>;
    }

    return (
        <section aria-label="Products from the test API">
            <h2>Products</h2>
            <p role="status">Loaded {data?.total ?? 0} products</p>
            <ul>
                {data?.items.map((product) => (
                    <li key={product.id}>{product.name}</li>
                ))}
            </ul>
            <button type="button" onClick={() => void refetch()}>
                Refresh products
            </button>
        </section>
    );
};
