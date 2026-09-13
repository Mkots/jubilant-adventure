# Integration Boundaries

The local database and external payment double are separate from the default in-memory API profile.

## PostgreSQL

```bash
npm run db:up
DATABASE_URL=postgresql://jubilant:${POSTGRES_PASSWORD}@127.0.0.1:5432/jubilant_adventure npm run db:migrate --workspace @jubilant-adventure/api
DATABASE_URL=postgresql://jubilant:${POSTGRES_PASSWORD}@127.0.0.1:5432/jubilant_adventure npm run db:test:schema --workspace @jubilant-adventure/api
```

`DATABASE_URL` is required by runtime migration and adapter code and is never committed. Reset only the named local volume with `npm run db:reset`.

The database integration suite uses Testcontainers and needs a running Docker or Podman daemon. If the daemon is unavailable, the suite reports a prerequisite error and CI uploads the diagnostic artifact; migration and repository failures remain regular test failures.

## WireMock

Start with `npm run wiremock:up`. Scenario selection uses `X-Payment-Scenario`: `success`, `decline`, `malformed`, `timeout`, `server-error`, or `replay`. Reset and recorded-request inspection use the WireMock admin API.

The fake contract is `POST /payments/authorize` with JSON `{ orderId, amount, currency }`, `Idempotency-Key`, and `X-Correlation-Id`. Success returns `{ providerTransactionId, status: "authorized" }`; failures use `{ error: { code, message } }`.

Stop with `npm run wiremock:down`. Mappings and fixtures live under `tests/wiremock/payment`.
