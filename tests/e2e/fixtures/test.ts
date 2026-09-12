import { test as base, expect } from '@playwright/test';

import { DocsPage } from '../pages/docs.page';

type Fixtures = {
    docsPage: DocsPage;
};

export const test = base.extend<Fixtures>({
    docsPage: async ({ page }, use) => {
        await use(new DocsPage(page));
    },
});

export { expect };
