# API workspace

Start the local API with:

```bash
npm run start --workspace apps/api
```

The server listens on `PORT` when configured and otherwise uses port `3000`.

Routes can be tested without opening a socket by importing `app` and calling
`app.request()` from Vitest. The Node adapter is covered separately with an
ephemeral port smoke test.
