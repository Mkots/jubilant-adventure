import { expect, test } from '../fixtures/test';

test.describe('Playwright documentation homepage', () => {
    test('shows the primary page content', async ({ homePage }) => {
        await homePage.goto();

        await expect(homePage.page).toHaveTitle(/Playwright/);
        await expect(homePage.heading).toBeVisible();
        await expect(homePage.getStartedLink).toBeVisible();
    });

    test('opens the getting started guide', async ({ docsPage, homePage }) => {
        await homePage.goto();
        await homePage.openGettingStarted();

        await expect(docsPage.page).toHaveURL(/\/docs\/intro/);
        await expect(docsPage.installationHeading).toBeVisible();
    });
});
