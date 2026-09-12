import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppErrorBoundary, AppLayout, NotFoundPage, RouteError } from './App';
import { RequireSession } from './features/auth/RequireSession';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { LoginPage } from './pages/LoginPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ProductsPage } from './pages/ProductsPage';
import { loadPersistedSession, persistSession } from './store/sessionStorage';
import { makeStore } from './store/store';
import './styles.css';

const store = makeStore({ session: loadPersistedSession() });
store.subscribe(() => persistSession(store.getState().session));

const router = createBrowserRouter([
    {
        element: <AppLayout />,
        errorElement: <RouteError />,
        children: [
            {
                path: '/',
                element: <ProductsPage />,
            },
            {
                path: '/products/:id',
                element: <ProductDetailPage />,
            },
            {
                path: '/cart',
                element: <CartPage />,
            },
            {
                path: '/checkout',
                element: <CheckoutPage />,
            },
            {
                path: '/login',
                element: <LoginPage />,
            },
            {
                path: '/orders',
                element: (
                    <RequireSession>
                        <OrdersPage />
                    </RequireSession>
                ),
            },
            {
                path: '/admin/orders',
                element: (
                    <RequireSession requiredRole="admin">
                        <OrdersPage admin />
                    </RequireSession>
                ),
            },
            { path: '*', element: <NotFoundPage /> },
        ],
    },
]);

createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
        <Provider store={store}>
            <AppErrorBoundary>
                <RouterProvider router={router} />
            </AppErrorBoundary>
        </Provider>
    </StrictMode>,
);
