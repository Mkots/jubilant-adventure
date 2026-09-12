# Browser E2E tests

This suite runs the React shop and Hono API as real local servers in
Playwright. It covers the three critical journeys that protect the shop's
most important user and operator behavior:

- Browse as a guest, sign in, add a product, complete checkout, and replay the
  same checkout request to verify idempotency.
- Open a user's order through the protected route and verify the user can read
  the order after signing in.
- Open the same order in the admin workspace and transition it from pending to
  paid.

Every test seeds the deterministic `baseline` fixture through the test-control
API. The browser uses only accessible UI locators and the public HTTP contract;
Redux state is never mutated by the tests. The mobile Chromium project runs the
complete browse-to-checkout journey, while the order-management flows run on
desktop Chromium.

## Prerequisites

- Node.js and npm versions from `.nvmrc` and `package.json`.
- Playwright's bundled Chromium browser.

Install dependencies and the browser once locally:

```bash
npm ci
npx playwright install chromium
```

GitHub Actions installs Chromium and its Linux dependencies automatically.

## Commands

Run all E2E tests:

```bash
npm run test:e2e
```

Check E2E TypeScript without launching a browser:

```bash
npm run type-check:e2e
```

Run one browser project while iterating:

```bash
npx playwright test --config=tests/e2e/playwright.config.ts --project=chromium-desktop
npx playwright test --config=tests/e2e/playwright.config.ts --project=chromium-mobile
```

Open the report after a run:

```bash
npm run test:e2e:report
```

Set `E2E_BASE_URL` and `E2E_API_BASE_URL` to test already-running servers. By
default Playwright starts the API on port `3412` in test mode and Vite on port
`4173`, then stops both managed processes when the run ends.

## Structure

```text
tests/e2e/
├── fixtures/
│   ├── shop.ts              # Reset/seed control and shop fixtures
│   └── test.ts              # Shared docs fixture
├── pages/
│   ├── docs.page.ts         # API docs page object
│   └── shop.page.ts         # Shop navigation and user actions
├── tests/
│   ├── critical-flows.spec.ts
│   ├── homepage.spec.ts     # OpenAPI smoke checks
│   └── responsive.spec.ts   # Docs usability on desktop and mobile
└── playwright.config.ts
```

Use web-first assertions such as `toBeVisible`, `toHaveText`, and `toHaveURL`.
Avoid fixed delays and selectors tied to generated CSS classes.
