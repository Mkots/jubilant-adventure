# Local API documentation smoke tests

This folder contains a small browser smoke suite for the API's local Swagger
UI at `/docs`. It is kept separate from the repository's Vitest tests so the
suite exercises a real Node server and a real browser workflow.

The suite runs the same tests in two Chromium projects:

- `chromium-desktop`: 1440 x 900 desktop viewport.
- `chromium-mobile`: Pixel 5 emulation (393 x 727 viewport, 393 x 851
  emulated screen).

Only Playwright's bundled Chromium browser is used. Firefox, WebKit, and
Google Chrome are intentionally not part of this example.

## Prerequisites

- Node.js and npm versions from the repository's `.nvmrc` and `package.json`.
- A local Chromium installation for Playwright.

Install the JavaScript dependencies and the Chromium browser once on a local
machine:

```bash
npm ci
npx playwright install chromium
```

The GitHub Actions workflow installs the browser and its Linux dependencies
automatically with `npx playwright install --with-deps chromium`; test traffic
then stays on the locally started API.

## Commands

Run all E2E tests in headless mode:

```bash
npm run test:e2e
```

Check the E2E TypeScript files without running a browser:

```bash
npm run type-check:e2e
```

Run one project when iterating on a test:

```bash
npx playwright test --config=tests/e2e/playwright.config.ts --project=chromium-desktop
npx playwright test --config=tests/e2e/playwright.config.ts --project=chromium-mobile
```

Open Playwright's interactive UI mode or run with a visible browser:

```bash
npm run test:e2e:ui
npm run test:e2e:headed
```

Open the HTML report after a run:

```bash
npm run test:e2e:report
```

Use `--debug` for the Inspector, `-g "text"` to filter by title, and
`--trace on` when investigating a local failure.

## Folder structure

```text
tests/e2e/
├── fixtures/
│   └── test.ts              # Extended test API and shared fixtures
├── pages/
│   └── docs.page.ts         # Page object for the local API docs
├── tests/
│   ├── homepage.spec.ts     # OpenAPI and operation smoke checks
│   └── responsive.spec.ts   # Docs usability on desktop and mobile
├── playwright.config.ts     # Projects, timeouts, artifacts, and reporters
└── README.md
```

## Practices demonstrated

### Page Object Model

Page objects in `pages/` own locators and reusable user actions. Tests stay
focused on behavior rather than CSS or DOM details. Prefer accessible
locators such as `getByRole`, `getByLabel`, and `getByText`; avoid brittle
selectors based on generated classes or deep CSS paths.

### Fixtures

`fixtures/test.ts` extends Playwright's built-in `test` function with
`docsPage`. Playwright creates an isolated `page` fixture per test, and the
custom fixture constructs the page object around that same page. Import `test`
and `expect` from this module in every spec that needs the shared setup.

### Web-first assertions

Use `expect(locator).toBeVisible()`, `toHaveText()`, `toHaveURL()`, and
`toHaveTitle()` instead of manually reading values and asserting immediately.
These assertions retry until the expected browser state is reached. Avoid
fixed waits such as `waitForTimeout`; wait for a meaningful locator, URL, or
response instead.

### Isolation and determinism

Tests do not depend on execution order or shared mutable state. The config
enables parallel execution locally, blocks accidental `test.only` usage in
CI, and retries failed tests twice in CI. A retry records a trace; failed
tests also keep screenshots and videos for diagnosis.

### Reporting

Local runs produce a list report and an HTML report in
`tests/e2e/playwright-report/`. CI also emits GitHub annotations and uploads
the HTML report plus failure artifacts. These generated directories are
ignored by Git.

## Adding a new test

1. Add a `*.spec.ts` file under `tests/e2e/tests/`.
2. Import `test` and `expect` from `../fixtures/test`.
3. Navigate through a page object or add a small page object when a workflow
   will be reused.
4. Locate elements by user-visible semantics and assert the resulting state.
5. Run the test in both projects before opening a pull request.

Example:

```ts
import { expect, test } from '../fixtures/test';

test('has the expected API docs title', async ({ docsPage }) => {
    await docsPage.goto();
    await expect(docsPage.title).toBeVisible();
});
```

## Target selection

The default target is `http://127.0.0.1:3000`. Playwright starts it through
the root `npm start` command and reuses an already-running server locally. Set
`E2E_BASE_URL` explicitly when a different target is required; in that mode
the automatic local web server is disabled.
