import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';

export const RequireSession = ({
    children,
    requiredRole,
}: {
    children: ReactNode;
    requiredRole?: 'user' | 'admin';
}): ReactNode => {
    const location = useLocation();
    const { token, user } = useAppSelector((state) => state.session);

    if (!token || !user) {
        const returnTo = `${location.pathname}${location.search}`;
        return (
            <Navigate
                replace
                to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            />
        );
    }

    if (requiredRole && user.role !== requiredRole) {
        return (
            <section className="access-page" aria-labelledby="access-title">
                <p className="eyebrow">Access denied</p>
                <h1 id="access-title">Admin access required</h1>
                <p>You do not have permission to manage orders.</p>
            </section>
        );
    }

    return children;
};
