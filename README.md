[![CI](https://github.com/Mkots/jubilant-adventure/actions/workflows/test-on-pr.yml/badge.svg?branch=main)](https://github.com/Mkots/jubilant-adventure/actions/workflows/test-on-pr.yml)
[![CodeQL](https://github.com/Mkots/jubilant-adventure/actions/workflows/github-code-scanning/codeql/badge.svg?branch=main)](https://github.com/Mkots/jubilant-adventure/actions/workflows/github-code-scanning/codeql)

A small TypeScript project containing programming exercises and a minimal HTTP server.

## Requirements

- Node.js `24.20.0` (see `.nvmrc`)
- npm `11` or newer

## Getting started

```bash
nvm install
nvm use
npm ci
```

## Commands

```bash
npm start             # start the HTTP server on port 3000
npm test              # run the test suite
npm run test:coverage # run tests with coverage
npm run type-check    # run TypeScript checks
npm run ci            # run all CI checks locally
npm run format        # format supported files
npm run lint          # run Biome lint checks
```

### 4. Run the Playwright E2E example

The browser-based example is isolated in [`tests/e2e/`](./tests/e2e/). It
tests the public Playwright documentation site in Chromium at desktop and
mobile resolutions. See [`tests/e2e/README.md`](./tests/e2e/README.md) for
setup, commands, fixtures, page objects, and CI guidance.

```bash
npx playwright install chromium
npm run test:e2e
```

## Project structure

- `apps/api/src` contains the HTTP server, routes, and entrypoint.
- `apps/api/__tests__` contains the API integration tests.
- `packages/exercises/src` contains the standalone exercises.
- `packages/exercises/__tests__` contains the exercise unit tests.
- `tests/e2e` contains the Playwright project, fixtures, page objects, and tests.
- `apps/web`, `packages/api-client`, and `packages/test-data` are reserved for
  future workspaces.

The server exposes `/sample`, `/sample/hello`, and returns a JSON `404` response for unknown routes.

## License

This project is distributed under the [MIT License](LICENSE).
