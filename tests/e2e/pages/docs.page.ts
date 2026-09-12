import { expect, type Locator, type Page } from '@playwright/test';

export class DocsPage {
    readonly page: Page;
    readonly title: Locator;
    readonly operations: Locator;

    constructor(page: Page) {
        this.page = page;
        this.title = page.getByRole('heading', {
            name: 'Jubilant Adventure Shop API',
        });
        this.operations = page.getByText('/auth/login', { exact: false });
    }

    async goto(): Promise<void> {
        const apiBaseURL =
            process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:3412';
        const openApiResponse = this.page.waitForResponse((response) => {
            const url = new URL(response.url());
            return (
                response.request().method() === 'GET' &&
                url.pathname === '/openapi.json'
            );
        });
        await this.page.goto(`${apiBaseURL}/docs`);
        await expect((await openApiResponse).status()).toBe(200);
    }

    operation(path: string): Locator {
        return this.page.getByText(path, { exact: false }).first();
    }
}
