import type { paths } from '@jubilant-adventure/api-client';
import { baseApi } from '../../store/api';

export type LoginRequest =
    paths['/auth/login']['post']['requestBody']['content']['application/json'];
export type LoginResponse =
    paths['/auth/login']['post']['responses'][200]['content']['application/json'];

const authApi = baseApi.injectEndpoints({
    endpoints: (build) => ({
        login: build.mutation<LoginResponse, LoginRequest>({
            query: (body) => ({
                url: '/auth/login',
                method: 'POST',
                body,
            }),
        }),
    }),
});

export const { useLoginMutation } = authApi;
