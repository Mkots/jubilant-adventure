import type { paths } from '@jubilant-adventure/api-client';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export type ApiPaths = paths;

const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? '/api';

export const baseApi = createApi({
    reducerPath: 'api',
    baseQuery: fetchBaseQuery({
        baseUrl: apiOrigin,
        prepareHeaders: (headers, { getState }) => {
            const token = (getState() as { session?: { token: string | null } })
                .session?.token;
            if (token) headers.set('authorization', `Bearer ${token}`);
            headers.set('accept', 'application/json');
            return headers;
        },
    }),
    tagTypes: ['Product', 'Cart', 'Order'],
    endpoints: () => ({}),
});
