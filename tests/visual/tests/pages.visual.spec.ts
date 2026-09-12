import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const stories = {
    adminOrder: 'pages-orderspage--admin-status-transition',
    cart: 'pages-cartpage--default',
    catalog: 'pages-productspage--default',
    catalogLong: 'pages-productspage--long-content',
    checkoutValidation: 'pages-checkoutpage--validation-focus',
} as const;

const openStory = async (page: Page, storyId: string): Promise<void> => {
    await page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
    await expect(page.locator('#storybook-root')).toBeVisible();
};

test.describe('critical visual states', () => {
    test('catalog default', async ({ page }) => {
        await openStory(page, stories.catalog);
        await expect(
            page.getByRole('heading', { name: 'Find your next favorite' }),
        ).toBeVisible();
        await expect(
            page.getByRole('list', { name: 'Product results' }),
        ).toBeVisible();
        await expect(page).toHaveScreenshot('catalog-default.png', {
            fullPage: true,
        });
    });

    test('catalog long content at a narrow viewport', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openStory(page, stories.catalogLong);
        await expect(
            page.getByRole('heading', {
                name: /A very carefully named .*Desk Lamp/,
            }),
        ).toBeVisible();
        await expect(
            page.getByRole('list', { name: 'Product results' }),
        ).toBeVisible();
        await expect(page).toHaveScreenshot('catalog-long-content-narrow.png', {
            fullPage: true,
        });
    });

    test('checkout validation focus', async ({ page }) => {
        await openStory(page, stories.checkoutValidation);
        const alert = page.getByRole('alert');
        await expect(alert).toHaveText('Email is required.');
        await expect(alert).toBeFocused();
        await expect(page).toHaveScreenshot('checkout-validation-focus.png', {
            fullPage: true,
        });
    });

    test('filled cart at a narrow viewport', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openStory(page, stories.cart);
        await expect(
            page.getByRole('heading', { name: 'Review your order' }),
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Comet Mug' }),
        ).toBeVisible();
        await expect(page).toHaveScreenshot('cart-filled-narrow.png', {
            fullPage: true,
        });
    });

    test('admin order status state', async ({ page }) => {
        await openStory(page, stories.adminOrder);
        await expect(
            page.getByRole('heading', {
                name: '00000000-0000-4000-8000-000000000501',
            }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Save status' }),
        ).toBeEnabled();
        await expect(page).toHaveScreenshot('admin-order-status.png', {
            fullPage: true,
        });
    });
});
