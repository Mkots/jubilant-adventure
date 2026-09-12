import type { Locator, Page } from '@playwright/test';

export class DocsPage {
    readonly page: Page;
    readonly installationHeading: Locator;

    constructor(page: Page) {
        this.page = page;
        this.installationHeading = page.getByRole('heading', {
            name: 'Installation',
        });
    }
}
