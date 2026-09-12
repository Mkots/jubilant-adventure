import { defineConfig, devices } from '@playwright/test';

const apiBaseURL = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:3412';
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';
const repoRoot = process.cwd();

export default defineConfig({
    testDir: './tests',
    outputDir: './test-results',
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    workers: 1,
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
        : [
              {
                  command:
                      'APP_MODE=test TEST_CONTROL_KEY=e2e-control API_TOKEN_SECRET=e2e-secret PORT=3412 npm start',
                  url: `${apiBaseURL}/openapi.json`,
                  reuseExistingServer: !process.env.CI,
                  timeout: 120_000,
              },
              {
                  command: `VITE_API_ORIGIN=/api VITE_API_PROXY_TARGET=http://127.0.0.1:3412 ${repoRoot}/node_modules/.bin/vite ${repoRoot}/apps/web --config ${repoRoot}/apps/web/vite.config.ts --host 127.0.0.1 --port 4173`,
                  url: `${baseURL}/`,
                  reuseExistingServer: !process.env.CI,
                  timeout: 120_000,
              },
          ],
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
