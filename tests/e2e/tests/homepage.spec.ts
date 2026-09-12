import { expect, test } from '../fixtures/test';

test.describe('local API documentation', () => {
    test('loads the generated contract and core operations', async ({
        docsPage,
    }) => {
        await docsPage.goto();

        await expect(docsPage.page).toHaveTitle('SwaggerUI');
        await expect(docsPage.title).toBeVisible();
        for (const path of [
            '/auth/login',
            '/products',
            '/cart/items',
            '/orders',
            '/orders/{id}/status',
        ]) {
            await expect(docsPage.operation(path)).toBeVisible();
        }
    });
});
