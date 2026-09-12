import { expect, test } from '../fixtures/shop';

test.beforeEach(async ({ control }) => {
    await control.seed();
});

test('browse, sign in, add to cart, and retry checkout safely', async ({
    control,
    page,
    shopPage,
}) => {
    await shopPage.gotoCatalog();
    const card = shopPage.product('Comet Mug');
    await card.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByRole('alert')).toContainText('Sign in to add items');
    await page.getByRole('link', { name: 'Sign in to add items' }).click();

    await shopPage.login();
    await shopPage.gotoCatalog();
    await shopPage.addProduct('Comet Mug');
    await shopPage.openCart();
    await expect(
        page.getByRole('heading', { name: 'Comet Mug' }),
    ).toBeVisible();
    await shopPage.openCheckout();

    const orderRequestPromise = page.waitForRequest(
        (request) =>
            request.method() === 'POST' &&
            new URL(request.url()).pathname.endsWith('/orders'),
    );
    const orderResponsePromise = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            new URL(response.url()).pathname.endsWith('/orders'),
    );
    await page.getByRole('button', { name: 'Place order' }).click();
    const [orderRequest, orderResponse] = await Promise.all([
        orderRequestPromise,
        orderResponsePromise,
    ]);
    expect(orderResponse.status()).toBe(201);
    const firstCheckout = (await orderResponse.json()) as {
        order: { id: string; status: string };
        replayed: boolean;
    };
    expect(firstCheckout.replayed).toBe(false);
    await expect(
        page.getByRole('heading', { name: 'Thanks for your order' }),
    ).toBeVisible();

    const replayResponse = await page.request.post(
        `${control.baseURL}/orders`,
        { headers: orderRequest.headers() },
    );
    expect(replayResponse.status()).toBe(200);
    const replay = (await replayResponse.json()) as {
        order: { id: string; status: string };
        replayed: boolean;
    };
    expect(replay.replayed).toBe(true);
    expect(replay.order.id).toBe(firstCheckout.order.id);
    expect(replay.order.status).toBe('pending');
});

test('a signed-in user can find only their order', async ({
    control,
    page,
    shopPage,
}, testInfo) => {
    testInfo.skip(
        testInfo.project.name === 'chromium-mobile',
        'The mobile project covers the complete checkout journey.',
    );
    const created = await control.createOrder(
        'user@example.test',
        'e2e-user-order',
    );

    await page.goto(`/orders?id=${created.order.id}`);
    await expect(page).toHaveURL(/\/login\?returnTo=/);
    await shopPage.login();
    await expect(page).toHaveURL(
        new RegExp(`/orders\\?id=${created.order.id}`),
    );
    await expect(
        page.getByRole('heading', { name: created.order.id }),
    ).toBeVisible();
    await expect(page.locator('dd').first()).toHaveText('Pending');
});

test('an admin can transition an order status', async ({
    control,
    page,
    shopPage,
}, testInfo) => {
    testInfo.skip(
        testInfo.project.name === 'chromium-mobile',
        'The desktop project covers the admin workspace flow.',
    );
    const created = await control.createOrder(
        'user@example.test',
        'e2e-admin-order',
    );

    await page.goto('/login');
    await shopPage.login('admin@example.test');
    await page.goto(`/admin/orders?id=${created.order.id}`);
    await expect(
        page.getByRole('heading', { name: 'Manage an order' }),
    ).toBeVisible();
    await page.getByLabel('New status').selectOption('paid');
    const updateResponsePromise = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            new URL(response.url()).pathname.endsWith(
                `/orders/${created.order.id}/status`,
            ),
    );
    await page.getByRole('button', { name: 'Save status' }).click();
    const updateResponse = await updateResponsePromise;
    expect(updateResponse.status()).toBe(200);
    await page.reload();
    await expect(page.locator('dd').first()).toHaveText('Paid');
});
