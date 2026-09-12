import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    getApiErrorMessage,
    getApiErrorStatus,
} from '../features/catalog/formatters';
import {
    allowedOrderTransitions,
    formatOrderDate,
    formatOrderMoney,
} from '../features/orders/orderFormatters';
import {
    type Order,
    useGetOrderQuery,
    useUpdateOrderStatusMutation,
} from '../features/orders/ordersApi';
import { baseApi } from '../store/api';
import { useAppDispatch } from '../store/hooks';
import { clearSession } from '../store/sessionSlice';

const statusLabel = (status: Order['status']): string =>
    status.charAt(0).toUpperCase() + status.slice(1);

const OrderSummary = ({ order }: { order: Order }): React.ReactNode => (
    <dl className="order-summary">
        <div>
            <dt>Status</dt>
            <dd>{statusLabel(order.status)}</dd>
        </div>
        <div>
            <dt>Total</dt>
            <dd>{formatOrderMoney(order)}</dd>
        </div>
        <div>
            <dt>Placed</dt>
            <dd>{formatOrderDate(order.createdAt)}</dd>
        </div>
    </dl>
);

const OrderDetails = ({ order }: { order: Order }): React.ReactNode => (
    <section className="order-details" aria-labelledby="order-detail-title">
        <div className="order-details__heading">
            <div>
                <p className="eyebrow">Order detail</p>
                <h2 id="order-detail-title">{order.id}</h2>
            </div>
            <Link className="button button--secondary" to="/">
                Continue shopping
            </Link>
        </div>
        <OrderSummary order={order} />
        <ul className="order-lines">
            {order.items.map((item) => (
                <li key={item.productId}>
                    <span>
                        <strong>{item.name}</strong>
                        <small>
                            {item.quantity} × {item.unitPrice.amount / 100}{' '}
                            {item.unitPrice.currency}
                        </small>
                    </span>
                    <strong>
                        {(item.total.amount / 100).toFixed(2)}{' '}
                        {item.total.currency}
                    </strong>
                </li>
            ))}
        </ul>
    </section>
);

const AdminStatusActions = ({
    onSessionExpired,
    order,
}: {
    onSessionExpired: () => void;
    order: Order;
}): React.ReactNode => {
    const dispatch = useAppDispatch();
    const transitions = allowedOrderTransitions[order.status];
    const [status, setStatus] = useState<Order['status']>(
        transitions[0] ?? order.status,
    );
    const [sessionExpired, setSessionExpired] = useState(false);
    const [updateStatus, updateState] = useUpdateOrderStatusMutation();
    const unauthorized = getApiErrorStatus(updateState.error) === 401;

    useEffect(() => {
        if (transitions[0]) setStatus(transitions[0]);
    }, [transitions]);

    useEffect(() => {
        if (unauthorized) {
            setSessionExpired(true);
            onSessionExpired();
            dispatch(clearSession());
            dispatch(baseApi.util.resetApiState());
        }
    }, [dispatch, onSessionExpired, unauthorized]);

    if (transitions.length === 0) {
        return (
            <p className="order-note">
                No further status changes are available.
            </p>
        );
    }

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        try {
            await updateStatus({ id: order.id, status }).unwrap();
        } catch {
            // The mutation error below keeps the server response visible.
        }
    };

    return (
        <section
            className="status-actions"
            aria-labelledby="status-actions-title"
        >
            <h3 id="status-actions-title">Update status</h3>
            <form onSubmit={submit}>
                <label>
                    New status
                    <select
                        onChange={(event) =>
                            setStatus(event.target.value as Order['status'])
                        }
                        value={status}
                    >
                        {transitions.map((nextStatus) => (
                            <option key={nextStatus} value={nextStatus}>
                                {statusLabel(nextStatus)}
                            </option>
                        ))}
                    </select>
                </label>
                <button
                    className="button"
                    disabled={updateState.isLoading}
                    type="submit"
                >
                    {updateState.isLoading ? 'Saving...' : 'Save status'}
                </button>
            </form>
            {(updateState.isError || sessionExpired) && (
                <div className="checkout-error" role="alert">
                    {unauthorized || sessionExpired ? (
                        <>
                            <strong>Your session expired.</strong>
                            <p>
                                <Link to="/login">Sign in again</Link> to
                                continue.
                            </p>
                        </>
                    ) : (
                        <>
                            <strong>Status update was rejected.</strong>
                            <p>{getApiErrorMessage(updateState.error)}</p>
                        </>
                    )}
                </div>
            )}
        </section>
    );
};

export const OrdersPage = ({
    admin = false,
}: {
    admin?: boolean;
}): React.ReactNode => {
    const dispatch = useAppDispatch();
    const [searchParams, setSearchParams] = useSearchParams();
    const [orderId, setOrderId] = useState(searchParams.get('id') ?? '');
    const [sessionExpired, setSessionExpired] = useState(false);
    const markSessionExpired = useCallback(() => setSessionExpired(true), []);
    const selectedId = searchParams.get('id')?.trim() ?? '';
    const orderQuery = useGetOrderQuery(selectedId, {
        skip: !selectedId || sessionExpired,
    });
    const unauthorized = getApiErrorStatus(orderQuery.error) === 401;
    const forbidden = getApiErrorStatus(orderQuery.error) === 403;

    useEffect(() => {
        if (unauthorized) {
            setSessionExpired(true);
            dispatch(clearSession());
            dispatch(baseApi.util.resetApiState());
        }
    }, [dispatch, unauthorized]);

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const nextId = orderId.trim();
        if (nextId) setSearchParams({ id: nextId });
    };

    return (
        <section className="orders-page" aria-labelledby="orders-title">
            <p className="eyebrow">{admin ? 'Admin workspace' : 'Orders'}</p>
            <h1 id="orders-title">
                {admin ? 'Manage an order' : 'Find an order'}
            </h1>
            <p className="orders-intro">
                Enter an order ID to view its current status and line items.
            </p>
            <form className="order-lookup" onSubmit={submit}>
                <label>
                    Order ID
                    <input
                        onChange={(event) => setOrderId(event.target.value)}
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        required
                        value={orderId}
                    />
                </label>
                <button className="button" type="submit">
                    Find order
                </button>
            </form>
            {!selectedId && (
                <p className="catalog-state">Enter an order ID to begin.</p>
            )}
            {selectedId && orderQuery.isFetching && (
                <p className="catalog-state" role="status">
                    Loading order...
                </p>
            )}
            {selectedId &&
                (orderQuery.isError || sessionExpired) &&
                !orderQuery.isFetching && (
                    <div
                        className="catalog-state catalog-state--error"
                        role="alert"
                    >
                        <h2>
                            {unauthorized || sessionExpired
                                ? 'Your session expired'
                                : forbidden
                                  ? 'Order access denied'
                                  : getApiErrorStatus(orderQuery.error) === 404
                                    ? 'Order not found'
                                    : 'Could not load order'}
                        </h2>
                        <p>
                            {unauthorized || sessionExpired
                                ? 'Sign in again to continue.'
                                : getApiErrorMessage(
                                      orderQuery.error,
                                      'The server could not load this order.',
                                  )}
                        </p>
                        {(unauthorized || sessionExpired) && (
                            <Link className="button" to="/login">
                                Sign in
                            </Link>
                        )}
                    </div>
                )}
            {orderQuery.data && (
                <>
                    <OrderDetails order={orderQuery.data} />
                    {admin && (
                        <AdminStatusActions
                            onSessionExpired={markSessionExpired}
                            order={orderQuery.data}
                        />
                    )}
                </>
            )}
        </section>
    );
};
