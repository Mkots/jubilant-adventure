const apiUrl = process.env.OBSERVABILITY_API_URL ?? 'http://127.0.0.1:3412';
const traceHeaders = { 'x-diagnostic-trace': '1' };

const login = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { ...traceHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.test', password: 'password' }),
});
if (!login.ok) throw new Error(`Login failed with ${login.status}`);
const { token } = await login.json();
const products = await fetch(`${apiUrl}/products?page=1&pageSize=1`, {
    headers: traceHeaders,
});
const { items } = await products.json();
const cart = await fetch(`${apiUrl}/cart/items`, {
    method: 'POST',
    headers: {
        ...traceHeaders,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
    },
    body: JSON.stringify({ productId: items[0].id, quantity: 1 }),
});
if (!cart.ok) throw new Error(`Cart update failed with ${cart.status}`);
const order = await fetch(`${apiUrl}/orders`, {
    method: 'POST',
    headers: {
        ...traceHeaders,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': `tempo-smoke-${Date.now()}`,
        'x-payment-scenario': 'success',
    },
});
if (!order.ok) throw new Error(`Checkout failed with ${order.status}`);
const traceId = order.headers.get('x-trace-id');
if (!traceId) throw new Error('API did not return X-Trace-Id for diagnostics');

const deadline = Date.now() + 60_000;
let traceBody = '';
while (Date.now() < deadline) {
    const response = await fetch(`http://127.0.0.1:3200/api/traces/${traceId}`);
    if (response.ok) {
        traceBody = await response.text();
        if (
            traceBody.includes('shop.checkout') &&
            traceBody.includes('payment.authorize')
        ) {
            process.stdout.write(`Tempo trace smoke passed: ${traceId}\n`);
            process.exit(0);
        }
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
}
throw new Error(
    `Trace ${traceId} was not queryable with checkout spans: ${traceBody}`,
);
