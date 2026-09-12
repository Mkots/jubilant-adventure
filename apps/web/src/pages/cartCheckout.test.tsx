import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import type { Cart, CheckoutResponse } from '../features/cart/cartApi';
import { apiUrl, fixtureProduct } from '../testing/mocks/handlers';
import { server } from '../testing/mocks/server';
import { renderWithProviders } from '../testing/renderWithProviders';
import { CartPage } from './CartPage';
import { CheckoutPage } from './CheckoutPage';
import { ProductsPage } from './ProductsPage';

const session = {
    token: 'fixture-token',
    user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'user@example.test',
        role: 'user' as const,
    },
};

const checkoutResponse: CheckoutResponse = {
    order: {
        id: '00000000-0000-4000-8000-000000000501',
        userId: session.user.id,
        idempotencyKey: 'checkout-fixture',
        items: [
            {
                productId: fixtureProduct.id,
                name: fixtureProduct.name,
                unitPrice: fixtureProduct.price,
                quantity: 1,
                total: fixtureProduct.price,
            },
        ],
        total: fixtureProduct.price,
        status: 'pending',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    },
    replayed: false,
};

const seedCartQuery = async () => {
    const cartView = renderWithProviders(<CartPage />, {
        preloadedState: { session },
        route: '/cart',
    });
    expect(
        await screen.findByRole('heading', { name: 'Your cart is empty' }),
    ).toBeVisible();
    cartView.unmount();
    return cartView.store;
};

describe('cart and checkout', () => {
    it('adds a product through the API and edits quantity with integer totals', async () => {
        server.use(
            http.post(apiUrl('/cart/items'), async ({ request }) => {
                const item = (await request.json()) as {
                    productId: string;
                    quantity: number;
                };
                const response: Cart = {
                    userId: session.user.id,
                    items: [item],
                };
                return HttpResponse.json(response);
            }),
        );
        const store = await seedCartQuery();
        const products = renderWithProviders(<ProductsPage />, {
            store,
            route: '/',
        });
        await products.user.click(
            await screen.findByRole('button', { name: 'Add to cart' }),
        );
        expect(await screen.findByText('Added to cart')).toBeVisible();
        products.unmount();

        const cart = renderWithProviders(<CartPage />, {
            store,
            route: '/cart',
        });
        expect(
            await screen.findByRole('heading', { name: 'Review your order' }),
        ).toBeVisible();
        expect(screen.getAllByText('$12.99')).toHaveLength(2);
        const quantity = screen.getByRole('spinbutton', {
            name: `Quantity for ${fixtureProduct.name}`,
        });
        await cart.user.clear(quantity);
        await cart.user.type(quantity, '2');
        await cart.user.click(screen.getByRole('button', { name: 'Update' }));
        await waitFor(() =>
            expect(screen.getAllByText('$25.98')).toHaveLength(2),
        );
    });

    it('keeps cart state and exposes a server stock conflict', async () => {
        server.use(
            http.post(apiUrl('/cart/items'), () =>
                HttpResponse.json(
                    {
                        code: 'insufficient_stock',
                        message: 'Requested quantity exceeds stock',
                    },
                    { status: 409 },
                ),
            ),
        );
        const view = renderWithProviders(<ProductsPage />, {
            preloadedState: { session },
        });
        await view.user.click(
            await screen.findByRole('button', { name: 'Add to cart' }),
        );
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Requested quantity exceeds stock',
        );
    });

    it('distinguishes an unauthorized cart mutation from a stock conflict', async () => {
        server.use(
            http.post(apiUrl('/cart/items'), () =>
                HttpResponse.json(
                    {
                        code: 'unauthorized',
                        message: 'Authentication is required',
                    },
                    { status: 401 },
                ),
            ),
        );
        const view = renderWithProviders(<ProductsPage />, {
            preloadedState: { session },
        });
        await view.user.click(
            await screen.findByRole('button', { name: 'Add to cart' }),
        );
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Authentication is required',
        );
    });

    it('focuses client validation on the checkout field before transport', async () => {
        const view = renderWithProviders(<CheckoutPage />, {
            preloadedState: { session },
        });
        const email = screen.getByRole('textbox', {
            name: 'Email for order updates',
        });
        await view.user.clear(email);
        await view.user.click(
            screen.getByRole('button', { name: 'Place order' }),
        );
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Email is required');
        expect(alert).toHaveFocus();
    });

    it('retries a checkout with the same idempotency key and shows replayed success', async () => {
        const keys: string[] = [];
        let attempts = 0;
        server.use(
            http.post(apiUrl('/orders'), ({ request }) => {
                keys.push(request.headers.get('idempotency-key') ?? '');
                attempts += 1;
                return attempts === 1
                    ? HttpResponse.json(
                          {
                              code: 'internal_error',
                              message: 'Temporary checkout failure',
                          },
                          { status: 500 },
                      )
                    : HttpResponse.json(
                          { ...checkoutResponse, replayed: true },
                          { status: 200 },
                      );
            }),
        );
        const view = renderWithProviders(<CheckoutPage />, {
            preloadedState: { session },
        });
        await view.user.click(
            screen.getByRole('button', { name: 'Place order' }),
        );
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Temporary checkout failure',
        );
        await view.user.click(
            screen.getByRole('button', { name: 'Place order' }),
        );
        expect(
            await screen.findByRole('heading', {
                name: 'Thanks for your order',
            }),
        ).toBeVisible();
        expect(keys).toHaveLength(2);
        expect(keys[0]).toBe(keys[1]);
        expect(screen.getByText(/safe replay/)).toBeVisible();
    });

    it('disables duplicate submit while one checkout attempt is pending', async () => {
        let requests = 0;
        server.use(
            http.post(apiUrl('/orders'), async () => {
                requests += 1;
                await new Promise((resolve) => setTimeout(resolve, 30));
                return HttpResponse.json(checkoutResponse, { status: 201 });
            }),
        );
        const view = renderWithProviders(<CheckoutPage />, {
            preloadedState: { session },
        });
        const button = screen.getByRole('button', { name: 'Place order' });
        await Promise.all([view.user.click(button), view.user.click(button)]);
        await waitFor(() => expect(requests).toBe(1));
        expect(
            await screen.findByRole('heading', {
                name: 'Thanks for your order',
            }),
        ).toBeVisible();
    });
});
