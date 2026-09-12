import { expect, test } from '../fixtures/test';

test.describe('responsive browser projects', () => {
    test('keeps the API operation list usable on the configured viewport', async ({
        docsPage,
        page,
    }) => {
        await docsPage.goto();
        await expect(docsPage.operations.first()).toBeVisible();

        const layout = await page.evaluate(() => ({
            viewportWidth: document.documentElement.clientWidth,
            documentWidth: document.documentElement.scrollWidth,
        }));
        expect(layout.documentWidth).toBeLessThanOrEqual(
            layout.viewportWidth + 1,
        );
    });
});
