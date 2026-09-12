import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppErrorBoundary, AppLayout, NotFoundPage, RouteError } from './App';
import { PlaceholderPage } from './pages/PlaceholderPage';
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
                element: (
                    <PlaceholderPage
                        description="Review items and quantities before checkout."
                        title="Cart"
                    />
                ),
            },
            {
                path: '/checkout',
                element: (
                    <PlaceholderPage
                        description="Complete your order with a protected checkout."
                        title="Checkout"
                    />
                ),
            },
            {
                path: '/login',
                element: (
                    <PlaceholderPage
                        description="Sign in to manage your cart and orders."
                        title="Login"
                    />
                ),
            },
            {
                path: '/orders',
                element: (
                    <PlaceholderPage
                        description="Your order history and details will appear here."
                        title="Orders"
                    />
                ),
            },
            {
                path: '/admin/orders',
                element: (
                    <PlaceholderPage
                        description="Admin order controls will appear here."
                        title="Admin orders"
                    />
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
