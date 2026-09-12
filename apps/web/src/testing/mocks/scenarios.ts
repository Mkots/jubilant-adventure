import { HttpResponse, http } from 'msw';
import { apiUrl, errorResponse, productsResponse } from './handlers';
import type { ProductList } from './types';

export const scenarioHandlers = {
    loading: http.get(apiUrl('/products'), async () => {
        await new Promise<never>(() => undefined);
    }),
    empty: http.get(apiUrl('/products'), () =>
        HttpResponse.json<ProductList>({
            ...productsResponse,
            items: [],
            total: 0,
            totalPages: 0,
        }),
    ),
    validationError: http.get(apiUrl('/products'), () =>
        HttpResponse.json(
            errorResponse('invalid_input', 'Invalid catalog query'),
            {
                status: 400,
            },
        ),
    ),
    unauthorized: http.get(apiUrl('/products'), () =>
        HttpResponse.json(
            errorResponse('unauthorized', 'Authentication is required'),
            {
                status: 401,
            },
        ),
    ),
    forbidden: http.get(apiUrl('/products'), () =>
        HttpResponse.json(errorResponse('forbidden', 'Access denied'), {
            status: 403,
        }),
    ),
    serverError: http.get(apiUrl('/products'), () =>
        HttpResponse.json(
            errorResponse('internal_error', 'Internal server error'),
            {
                status: 500,
            },
        ),
    ),
};
