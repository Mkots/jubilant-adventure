import type { paths } from '@jubilant-adventure/api-client';
import { baseApi } from '../../store/api';
import type { Product } from '../catalog/catalogApi';

export type Cart =
    paths['/cart/items']['post']['responses'][200]['content']['application/json'];
export type CartItemRequest =
    paths['/cart/items']['post']['requestBody']['content']['application/json'];
export type CheckoutResponse =
    paths['/orders']['post']['responses'][201]['content']['application/json'];

export interface CartLine {
    product: Product;
    productId: string;
    quantity: number;
}

export interface CartView {
    userId: string;
    items: CartLine[];
}

export interface AddCartItemArgs extends CartItemRequest {
    product: Product;
}

export interface CheckoutArgs {
    idempotencyKey: string;
}

const emptyCart: CartView = { userId: '', items: [] };

export const cartApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        getCart: build.query<CartView, void>({
            queryFn: () => ({ data: emptyCart }),
            providesTags: [{ type: 'Cart', id: 'CURRENT' }],
        }),
        addCartItem: build.mutation<Cart, AddCartItemArgs>({
            query: ({ product: _product, ...item }) => ({
                url: '/cart/items',
                method: 'POST',
                body: item,
            }),
            async onQueryStarted(
                args,
                { dispatch, queryFulfilled },
            ): Promise<void> {
                try {
                    const { data } = await queryFulfilled;
                    dispatch(
                        cartApi.util.upsertQueryData('getCart', undefined, {
                            userId: data.userId,
                            items: data.items.map((item) => ({
                                ...item,
                                product: args.product,
                            })),
                        }),
                    );
                } catch {
                    // The component owns the visible mutation error.
                }
            },
        }),
        checkout: build.mutation<CheckoutResponse, CheckoutArgs>({
            query: ({ idempotencyKey }) => ({
                url: '/orders',
                method: 'POST',
                headers: { 'idempotency-key': idempotencyKey },
            }),
        }),
    }),
});

export const { useAddCartItemMutation, useCheckoutMutation, useGetCartQuery } =
    cartApi;
