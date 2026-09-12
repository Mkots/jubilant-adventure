import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the E2E learning example.
 *
 * The application under test is the public Playwright documentation site.
 * Keeping the base URL here makes test URLs short and makes the target easy
 * to replace with a local application later.
 */
export default defineConfig({
    testDir: './tests',
    outputDir: './test-results',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    timeout: 30_000,
    expect: {
        timeout: 5_000,
    },
    reporter: process.env.CI
        ? [
              ['list'],
              ['github'],
              ['html', { outputFolder: './playwright-report', open: 'never' }],
          ]
        : [
              ['list'],
              ['html', { outputFolder: './playwright-report', open: 'never' }],
          ],
    use: {
        baseURL: 'https://playwright.dev',
        headless: true,
        locale: 'en-US',
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
        video: 'retain-on-failure',
        navigationTimeout: 15_000,
        actionTimeout: 10_000,
    },
    projects: [
        {
            name: 'chromium-desktop',
            use: {
                ...devices['Desktop Chrome'],
                browserName: 'chromium',
                viewport: { width: 1440, height: 900 },
            },
        },
        {
            name: 'chromium-mobile',
            use: {
                ...devices['Pixel 5'],
                browserName: 'chromium',
            },
        },
    ],
});
