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

## Project structure

- `src/utils` contains the standalone exercises.
- `src/routes` contains the HTTP route definitions.
- `src/server.ts` creates the HTTP server and is covered by integration tests.
- `__tests__` contains unit and server tests.

The server exposes `/sample`, `/sample/hello`, and returns a JSON `404` response for unknown routes.

## License

This project is distributed under the [MIT License](LICENSE).
