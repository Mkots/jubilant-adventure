import type { paths } from '@jubilant-adventure/api-client';
import { baseApi } from '../../store/api';

export type ProductList =
    paths['/products']['get']['responses'][200]['content']['application/json'];
type ApiProductQuery = paths['/products']['get']['query'];
export type Product = ProductList['items'][number];
export type ProductQuery = Omit<ApiProductQuery, 'page' | 'pageSize'> &
    Required<Pick<ApiProductQuery, 'page' | 'pageSize'>>;

const catalogApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        getProducts: build.query<ProductList, ProductQuery>({
            query: (params) => ({
                url: '/products',
                params,
            }),
            providesTags: (result) =>
                result
                    ? [
                          ...result.items.map(({ id }) => ({
                              type: 'Product' as const,
                              id,
                          })),
                          { type: 'Product' as const, id: 'LIST' },
                      ]
                    : [{ type: 'Product' as const, id: 'LIST' }],
        }),
        getProduct: build.query<Product, string>({
            query: (id) => `/products/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Product', id }],
        }),
    }),
});

export const { useGetProductQuery, useGetProductsQuery } = catalogApi;
