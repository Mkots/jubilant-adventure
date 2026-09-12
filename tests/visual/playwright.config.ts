import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:6006';

export default defineConfig({
    testDir: './',
    testMatch: 'tests/visual/tests/**/*.visual.spec.ts',
    outputDir: './test-results',
    snapshotPathTemplate: 'snapshots/{projectName}/{arg}{ext}',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 1 : undefined,
    timeout: 30_000,
    expect: {
        timeout: 10_000,
        toHaveScreenshot: {
            animations: 'disabled',
            caret: 'hide',
            maxDiffPixelRatio: 0.01,
            scale: 'css',
        },
    },
    reporter: process.env.CI
        ? [
              ['list'],
              ['github'],
              [
                  'html',
                  {
                      outputFolder: './playwright-report',
                      open: 'never',
                  },
              ],
          ]
        : [
              ['list'],
              [
                  'html',
                  {
                      outputFolder: './playwright-report',
                      open: 'never',
                  },
              ],
          ],
    use: {
        ...devices['Desktop Chrome'],
        baseURL,
        browserName: 'chromium',
        colorScheme: 'light',
        headless: true,
        locale: 'en-US',
        navigationTimeout: 15_000,
        reducedMotion: 'reduce',
        screenshot: 'only-on-failure',
        timezoneId: 'UTC',
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
        viewport: { width: 1280, height: 800 },
    },
    webServer: {
        command: 'npm run storybook:visual',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: `${baseURL}/iframe.html`,
    },
});
