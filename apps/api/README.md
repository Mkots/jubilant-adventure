# API workspace

Start the local API with:

```bash
npm run start --workspace apps/api
```

The server listens on `PORT` when configured and otherwise uses port `3000`.

Routes can be tested without opening a socket by importing `app` and calling
`app.request()` from Vitest. The Node adapter is covered separately with an
ephemeral port smoke test.

The generated OpenAPI 3.1 contract is available at `/openapi.json` and Swagger
UI is available at `/docs`. Add business routes with `createRoute` and
`app.openapi`; the contract inventory test rejects reachable undocumented
`/auth`, `/products`, `/cart`, or `/orders` routes.
