import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';

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
        baseURL,
        headless: true,
        locale: 'en-US',
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
        video: 'retain-on-failure',
        navigationTimeout: 15_000,
        actionTimeout: 10_000,
    },
    webServer: process.env.E2E_BASE_URL
        ? undefined
        : {
              command: 'npm start',
              url: `${baseURL}/docs`,
              reuseExistingServer: !process.env.CI,
              timeout: 120_000,
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
