[![CodeQL](https://github.com/Mkots/jubilant-adventure/actions/workflows/github-code-scanning/codeql/badge.svg?branch=main)](https://github.com/Mkots/jubilant-adventure/actions/workflows/github-code-scanning/codeql)
[![CI Pipeline](https://github.com/Mkots/jubilant-adventure/actions/workflows/test-on-pr.yml/badge.svg?branch=main)](https://github.com/Mkots/jubilant-adventure/actions/workflows/test-on-pr.yml)
[![codecov](https://codecov.io/gh/Mkots/jubilant-adventure/branch/main/graph/badge.svg?token=0S8USUDUYG)](https://codecov.io/gh/Mkots/jubilant-adventure)

### 1. Setup env

```bash
nvm install && nvm use
```

### 2. Install

```bash
npm ci
```

### 3. Run tests

```bash
npm run test
```

### 4. Run the Playwright E2E example

The browser-based example is isolated in [`playwright/`](./playwright/). It
tests the public Playwright documentation site in Chromium at desktop and
mobile resolutions. See [`playwright/README.md`](./playwright/README.md) for
setup, commands, fixtures, page objects, and CI guidance.

```bash
npx playwright install chromium
npm run test:e2e
```
