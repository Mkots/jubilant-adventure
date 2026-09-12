import { test as base, expect } from '@playwright/test';

import { DocsPage } from '../pages/docs.page';
import { HomePage } from '../pages/home.page';

type Fixtures = {
    docsPage: DocsPage;
    homePage: HomePage;
};

/**
 * Shared test API for this example.
 *
 * Fixtures keep setup in one place and create page objects with the test's
 * isolated Page instance. Tests import from this module instead of repeating
 * construction details in every spec.
 */
export const test = base.extend<Fixtures>({
    docsPage: async ({ page }, use) => {
        await use(new DocsPage(page));
    },
    homePage: async ({ page }, use) => {
        await use(new HomePage(page));
    },
});

export { expect };
