import type { Locator, Page } from '@playwright/test';

export class HomePage {
    readonly page: Page;
    readonly heading: Locator;
    readonly getStartedLink: Locator;

    constructor(page: Page) {
        this.page = page;
        this.heading = page.getByRole('banner').getByRole('heading', {
            name: /Playwright enables reliable web automation/i,
        });
        this.getStartedLink = page.getByRole('banner').getByRole('link', {
            name: 'Get started',
        });
    }

    async goto(): Promise<void> {
        await this.page.goto('/');
    }

    async openGettingStarted(): Promise<void> {
        await this.getStartedLink.click();
    }
}
