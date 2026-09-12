import type { paths } from '@jubilant-adventure/api-client';
import { baseApi } from '../../store/api';

export type Order =
    paths['/orders/{id}']['get']['responses'][200]['content']['application/json'];
export type OrderStatus = Order['status'];
export type OrderStatusRequest =
    paths['/orders/{id}/status']['patch']['requestBody']['content']['application/json'];

const ordersApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        getOrder: build.query<Order, string>({
            query: (id) => `/orders/${id}`,
            providesTags: (_result, _error, id) => [{ type: 'Order', id }],
        }),
        updateOrderStatus: build.mutation<
            Order,
            { id: string; status: OrderStatus }
        >({
            query: ({ id, status }) => ({
                url: `/orders/${id}/status`,
                method: 'PATCH',
                body: { status } satisfies OrderStatusRequest,
            }),
            invalidatesTags: (_result, _error, { id }) => [
                { type: 'Order', id },
            ],
        }),
    }),
});

export const { useGetOrderQuery, useUpdateOrderStatusMutation } = ordersApi;
