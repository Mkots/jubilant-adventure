import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppLayout } from '../App';
import { RequireSession } from '../features/auth/RequireSession';
import type { Order } from '../features/orders/ordersApi';
import { apiUrl, fixtureProduct } from '../testing/mocks/handlers';
import { server } from '../testing/mocks/server';
import { renderWithProviders } from '../testing/renderWithProviders';
import { LoginPage } from './LoginPage';
import { OrdersPage } from './OrdersPage';

const userSession = {
    token: 'user-token',
    user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'user@example.test',
        role: 'user' as const,
    },
};

const adminSession = {
    token: 'admin-token',
    user: {
        id: '00000000-0000-4000-8000-000000000002',
        email: 'admin@example.test',
        role: 'admin' as const,
    },
};

const order: Order = {
    id: '00000000-0000-4000-8000-000000000501',
    userId: userSession.user.id,
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
};

describe('auth and orders', () => {
    it('redirects a protected route to login and returns after successful sign in', async () => {
        server.use(
            http.post(apiUrl('/auth/login'), () =>
                HttpResponse.json({
                    token: 'fresh-token',
                    expiresIn: 900,
                    user: userSession.user,
                }),
            ),
        );
        const view = renderWithProviders(
            <Routes>
                <Route element={<LoginPage />} path="/login" />
                <Route
                    element={
                        <RequireSession>
                            <p>Orders destination</p>
                        </RequireSession>
                    }
                    path="/orders"
                />
            </Routes>,
            { route: '/orders' },
        );

        expect(
            await screen.findByRole('heading', { name: 'Sign in' }),
        ).toBeVisible();
        expect(view.store.getState().session.token).toBeNull();
        const email = screen.getByRole('textbox', { name: 'Email' });
        await view.user.type(email, 'user@example.test');
        await view.user.type(screen.getByLabelText('Password'), 'password');
        await view.user.click(screen.getByRole('button', { name: 'Sign in' }));

        expect(await screen.findByText('Orders destination')).toBeVisible();
        expect(view.store.getState().session.token).toBe('fresh-token');
    });

    it('shows role-aware navigation and clears session and cache on logout', async () => {
        const userView = renderWithProviders(<AppLayout />, {
            preloadedState: { session: userSession },
        });
        expect(screen.getByRole('link', { name: 'Orders' })).toBeVisible();
        expect(screen.queryByRole('link', { name: 'Admin orders' })).toBeNull();
        await userView.user.click(
            screen.getByRole('button', { name: 'Sign out' }),
        );
        expect(screen.getByText('Guest session')).toBeVisible();
        expect(screen.getByRole('link', { name: 'Login' })).toBeVisible();
        expect(screen.queryByRole('link', { name: 'Orders' })).toBeNull();
        expect(userView.store.getState().session.token).toBeNull();
        userView.unmount();

        renderWithProviders(<AppLayout />, {
            preloadedState: { session: adminSession },
        });
        expect(
            screen.getByRole('link', { name: 'Admin orders' }),
        ).toBeVisible();
    });

    it('shows invalid credential field errors without creating a session', async () => {
        server.use(
            http.post(apiUrl('/auth/login'), () =>
                HttpResponse.json(
                    {
                        code: 'invalid_credentials',
                        message: 'Invalid email or password',
                        fields: { email: 'Use your account email' },
                    },
                    { status: 401 },
                ),
            ),
        );
        const view = renderWithProviders(<LoginPage />);
        await view.user.type(
            screen.getByRole('textbox', { name: 'Email' }),
            'wrong@example.test',
        );
        await view.user.type(screen.getByLabelText('Password'), 'wrong');
        await view.user.click(screen.getByRole('button', { name: 'Sign in' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Invalid email or password',
        );
        expect(screen.getByText('Use your account email')).toBeVisible();
        expect(view.store.getState().session.token).toBeNull();
    });

    it('turns an expired order session into a visible recovery state', async () => {
        server.use(
            http.get(apiUrl(`/orders/${order.id}`), () =>
                HttpResponse.json(
                    {
                        code: 'unauthorized',
                        message: 'Authentication is required',
                    },
                    { status: 401 },
                ),
            ),
        );
        const view = renderWithProviders(<OrdersPage />, {
            preloadedState: { session: userSession },
            route: `/orders?id=${order.id}`,
        });
        expect(
            await screen.findByRole('heading', {
                name: 'Your session expired',
            }),
        ).toBeVisible();
        expect(screen.getByRole('link', { name: 'Sign in' })).toBeVisible();
        expect(view.store.getState().session.token).toBeNull();
    });

    it('renders an owned order and exposes ownership errors', async () => {
        server.use(
            http.get(apiUrl(`/orders/${order.id}`), () =>
                HttpResponse.json(order),
            ),
        );
        const view = renderWithProviders(<OrdersPage />, {
            preloadedState: { session: userSession },
            route: `/orders?id=${order.id}`,
        });
        expect(
            await screen.findByRole('heading', { name: order.id }),
        ).toBeVisible();
        expect(screen.getByText('Comet Mug')).toBeVisible();
        expect(screen.getByText('$12.99')).toBeVisible();

        view.unmount();
        server.use(
            http.get(apiUrl(`/orders/${order.id}`), () =>
                HttpResponse.json(
                    {
                        code: 'forbidden',
                        message: 'You cannot access this order',
                    },
                    { status: 403 },
                ),
            ),
        );
        renderWithProviders(<OrdersPage />, {
            preloadedState: { session: userSession },
            route: `/orders?id=${order.id}`,
        });
        expect(
            await screen.findByRole('heading', { name: 'Order access denied' }),
        ).toBeVisible();
    });

    it('shows forbidden, missing, and rejected status responses as user-visible states', async () => {
        server.use(
            http.get(apiUrl(`/orders/${order.id}`), () =>
                HttpResponse.json(order),
            ),
            http.patch(apiUrl(`/orders/${order.id}/status`), () =>
                HttpResponse.json(
                    {
                        code: 'forbidden',
                        message: 'Only admins can change order status',
                    },
                    { status: 403 },
                ),
            ),
        );
        const view = renderWithProviders(<OrdersPage admin />, {
            preloadedState: { session: adminSession },
            route: `/admin/orders?id=${order.id}`,
        });
        expect(
            await screen.findByRole('heading', { name: order.id }),
        ).toBeVisible();
        expect(screen.getByRole('option', { name: 'Paid' })).toBeVisible();
        await view.user.click(
            screen.getByRole('button', { name: 'Save status' }),
        );
        expect(
            await screen.findByText('Only admins can change order status'),
        ).toBeVisible();

        view.unmount();
        server.use(
            http.get(apiUrl(`/orders/${order.id}`), () =>
                HttpResponse.json(
                    { code: 'not_found', message: 'Order not found' },
                    { status: 404 },
                ),
            ),
        );
        renderWithProviders(<OrdersPage admin />, {
            preloadedState: { session: adminSession },
            route: `/admin/orders?id=${order.id}`,
        });
        await waitFor(() =>
            expect(
                screen.getByRole('heading', { name: 'Order not found' }),
            ).toBeVisible(),
        );
    });
});
