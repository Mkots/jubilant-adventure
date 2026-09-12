import { expect, type Locator, type Page } from '@playwright/test';

export class ShopPage {
    constructor(readonly page: Page) {}

    product(name: string): Locator {
        return this.page
            .getByRole('listitem')
            .filter({ has: this.page.getByRole('heading', { name }) });
    }

    async gotoCatalog(): Promise<void> {
        await this.page.goto('/');
        await expect(
            this.page.getByRole('heading', { name: 'Find your next favorite' }),
        ).toBeVisible();
    }

    async login(
        email = 'user@example.test',
        password = 'password',
    ): Promise<void> {
        await this.page.getByLabel('Email').fill(email);
        await this.page.getByLabel('Password').fill(password);
        await this.page.getByRole('button', { name: 'Sign in' }).click();
        await expect(
            this.page.getByText(`Signed in as ${email}`, { exact: true }),
        ).toBeVisible();
    }

    async addProduct(name: string): Promise<void> {
        const card = this.product(name);
        await expect(card).toBeVisible();
        await card.getByRole('button', { name: 'Add to cart' }).click();
        await expect(
            card.getByText('Added to cart', { exact: true }),
        ).toBeVisible();
    }

    async openCart(): Promise<void> {
        await this.page
            .getByRole('link', { name: 'Cart', exact: true })
            .click();
        await expect(
            this.page.getByRole('heading', { name: 'Review your order' }),
        ).toBeVisible();
    }

    async openCheckout(): Promise<void> {
        await this.page
            .getByRole('link', { name: 'Continue to checkout' })
            .click();
        await expect(
            this.page.getByRole('heading', { name: 'Complete your order' }),
        ).toBeVisible();
    }
}
