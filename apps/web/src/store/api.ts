import type { paths } from '@jubilant-adventure/api-client';
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { captureFrontendException } from '../observability/sentry';

export type ApiPaths = paths;

const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? '/api';
const rawBaseQuery = fetchBaseQuery({
    baseUrl: apiOrigin,
    prepareHeaders: (headers, { getState }) => {
        const token = (getState() as { session?: { token: string | null } })
            .session?.token;
        if (token) headers.set('authorization', `Bearer ${token}`);
        headers.set('accept', 'application/json');
        headers.set('x-correlation-id', crypto.randomUUID());
        return headers;
    },
});

export const baseApi = createApi({
    reducerPath: 'api',
    baseQuery: async (args, api, extraOptions) => {
        const result = await rawBaseQuery(args, api, extraOptions);
        const correlationId =
            result.meta?.response?.headers.get('x-correlation-id');
        if (result.error?.status === 'FETCH_ERROR') {
            captureFrontendException(
                new Error(result.error.error),
                correlationId ?? undefined,
            );
        }
        return result;
    },
    tagTypes: ['Product', 'Cart', 'Order'],
    endpoints: () => ({}),
});
