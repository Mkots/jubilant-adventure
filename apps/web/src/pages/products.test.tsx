import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
    apiUrl,
    fixtureProduct,
    productsResponse,
} from '../testing/mocks/handlers';
import { scenarioHandlers } from '../testing/mocks/scenarios';
import { server } from '../testing/mocks/server';
import { renderWithProviders } from '../testing/renderWithProviders';
import { ProductDetailPage } from './ProductDetailPage';
import { ProductsPage } from './ProductsPage';

const secondProduct = {
    ...fixtureProduct,
    id: '00000000-0000-4000-8000-000000000102',
    name: 'Orbit Notebook',
    stock: 8,
};

describe('product catalog', () => {
    it('loads a shareable URL query and renders product details', async () => {
        const requested = vi.fn();
        server.use(
            http.get(apiUrl('/products'), ({ request }) => {
                requested(
                    Object.fromEntries(new URL(request.url).searchParams),
                );
                return HttpResponse.json(productsResponse);
            }),
        );

        const view = renderWithProviders(<ProductsPage />, {
            route: '/?search=mug&sort=price&direction=desc',
        });

        expect(
            await screen.findByRole('heading', { name: 'Comet Mug' }),
        ).toBeVisible();
        expect(
            screen.getByRole('searchbox', { name: 'Search products' }),
        ).toHaveValue('mug');
        await waitFor(() =>
            expect(requested).toHaveBeenCalledWith({
                page: '1',
                pageSize: '20',
                search: 'mug',
                sort: 'price',
                direction: 'desc',
            }),
        );
        await view.user.click(
            screen.getByRole('button', { name: 'Add to cart' }),
        );
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Sign in to add items',
        );
    });

    it('changes the URL-backed search only after submit', async () => {
        const requestedSearches: string[] = [];
        server.use(
            http.get(apiUrl('/products'), ({ request }) => {
                requestedSearches.push(
                    new URL(request.url).searchParams.get('search') ?? '',
                );
                return HttpResponse.json(productsResponse);
            }),
        );
        const view = renderWithProviders(<ProductsPage />);
        const search = screen.getByRole('searchbox', {
            name: 'Search products',
        });

        await view.user.type(search, ' keyboard');
        expect(requestedSearches).toEqual(['']);
        await view.user.click(screen.getByRole('button', { name: 'Search' }));
        await waitFor(() => expect(requestedSearches).toContain('keyboard'));
    });

    it('shows an empty state', async () => {
        server.use(scenarioHandlers.empty);
        renderWithProviders(<ProductsPage />);
        expect(
            await screen.findByRole('heading', { name: 'No products found' }),
        ).toBeVisible();
    });

    it('keeps a stable loading state for a slow response', async () => {
        server.use(scenarioHandlers.loading);
        renderWithProviders(<ProductsPage />, { route: '/?page=2' });
        expect(await screen.findByText('Loading products...')).toBeVisible();
    });

    it('recovers from a server error with retry', async () => {
        let attempts = 0;
        server.use(
            http.get(apiUrl('/products'), () => {
                attempts += 1;
                return attempts === 1
                    ? HttpResponse.json(
                          { code: 'internal_error', message: 'Please retry' },
                          { status: 500 },
                      )
                    : HttpResponse.json(productsResponse);
            }),
        );

        const view = renderWithProviders(<ProductsPage />);
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Please retry',
        );
        await view.user.click(
            screen.getByRole('button', { name: 'Try again' }),
        );
        expect(
            await screen.findByRole('heading', { name: 'Comet Mug' }),
        ).toBeVisible();
        expect(attempts).toBe(2);
    });

    it('handles long names, out-of-stock products, and pagination', async () => {
        const longName = `${'A '.repeat(35)}Desk Lamp`;
        server.use(
            http.get(apiUrl('/products'), ({ request }) => {
                const page = Number(
                    new URL(request.url).searchParams.get('page') ?? 1,
                );
                const product =
                    page === 1
                        ? { ...fixtureProduct, name: longName, stock: 0 }
                        : secondProduct;
                return HttpResponse.json({
                    items: [product],
                    total: 2,
                    page,
                    pageSize: 1,
                    totalPages: 2,
                });
            }),
        );

        const view = renderWithProviders(<ProductsPage />, {
            route: '/?pageSize=1',
        });
        expect(
            await screen.findByRole('heading', { name: longName }),
        ).toBeVisible();
        expect(
            screen.getByRole('button', { name: 'Out of stock' }),
        ).toBeDisabled();
        await view.user.click(screen.getByRole('button', { name: 'Next' }));
        expect(
            await screen.findByRole('heading', { name: 'Orbit Notebook' }),
        ).toBeVisible();
    });

    it('renders the product detail route from the generated API shape', async () => {
        renderWithProviders(
            <Routes>
                <Route element={<ProductDetailPage />} path="/products/:id" />
            </Routes>,
            { route: `/products/${fixtureProduct.id}` },
        );

        expect(
            await screen.findByRole('heading', { name: 'Comet Mug' }),
        ).toBeVisible();
        expect(screen.getByText('$12.99')).toBeVisible();
        expect(screen.getByText('12 in stock')).toBeVisible();
    });
});
