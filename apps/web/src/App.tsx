import { Component, type ReactNode } from 'react';
import {
    Link,
    NavLink,
    Outlet,
    useNavigate,
    useRouteError,
} from 'react-router-dom';
import { baseApi } from './store/api';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { clearSession } from './store/sessionSlice';

const publicNavItems = [
    { to: '/', label: 'Products', end: true },
    { to: '/cart', label: 'Cart' },
    { to: '/checkout', label: 'Checkout' },
];

export const AppLayout = (): ReactNode => {
    const user = useAppSelector((state) => state.session.user);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const navItems = [
        ...publicNavItems,
        ...(user ? [{ to: '/orders', label: 'Orders' }] : []),
        ...(user?.role === 'admin'
            ? [{ to: '/admin/orders', label: 'Admin orders' }]
            : []),
        ...(!user ? [{ to: '/login', label: 'Login' }] : []),
    ];

    const logout = (): void => {
        dispatch(clearSession());
        dispatch(baseApi.util.resetApiState());
        navigate('/login', { replace: true });
    };
    return (
        <div className="app-shell">
            <header className="site-header">
                <Link className="brand" to="/">
                    Jubilant Adventure
                </Link>
                <nav aria-label="Primary navigation">
                    {navItems.map((item) => (
                        <NavLink
                            className={({ isActive }) =>
                                isActive ? 'nav-link active' : 'nav-link'
                            }
                            end={item.end}
                            key={item.to}
                            to={item.to}
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
                <p className="session-summary" aria-live="polite">
                    {user ? `Signed in as ${user.email}` : 'Guest session'}
                </p>
                {user && (
                    <button
                        className="header-action"
                        onClick={logout}
                        type="button"
                    >
                        Sign out
                    </button>
                )}
            </header>
            <main className="page-content">
                <Outlet />
            </main>
        </div>
    );
};

export class AppErrorBoundary extends Component<
    { children: ReactNode },
    { hasError: boolean }
> {
    public state = { hasError: false };

    public static getDerivedStateFromError(): { hasError: boolean } {
        return { hasError: true };
    }

    public componentDidCatch(): void {}

    public render(): ReactNode {
        if (this.state.hasError) {
            return (
                <main className="error-page" role="alert">
                    <h1>Something went wrong</h1>
                    <p>Refresh the page to try again.</p>
                </main>
            );
        }
        return this.props.children;
    }
}

export const RouteError = (): ReactNode => {
    const error = useRouteError();
    const message =
        error instanceof Error ? error.message : 'Unknown route error';
    return (
        <section className="error-page" role="alert">
            <h1>Unable to load this page</h1>
            <p>{message}</p>
            <Link className="button" to="/">
                Return to products
            </Link>
        </section>
    );
};

export const NotFoundPage = (): ReactNode => (
    <section className="empty-page">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>The page you requested does not exist.</p>
        <Link className="button" to="/">
            Return to products
        </Link>
    </section>
);
