# API verification

`npm run test:api` starts the Node adapter on an ephemeral port and exercises the public HTTP API. Each test resets state through the test-control endpoint, so the scenarios do not share repository objects or depend on execution order.

`npm run test:schemathesis` runs a deterministic bounded profile against `SCHEMATHESIS_SPEC` and `SCHEMATHESIS_BASE_URL` (defaulting to `http://127.0.0.1:3412/openapi.json` and `http://127.0.0.1:3412`). CI supplies a temporary Python environment and keeps the JUnit report under `artifacts/`, including when checks fail. The profile uses seed `20260912`, coverage and fuzzing phases only, at most 20 examples per operation, a 10-second total budget, and a 1-second request deadline. It checks server errors, status codes, content types, and response schemas; state-sensitive positive/negative acceptance and stateful checks stay in the exact HTTP suite. Set `SCHEMATHESIS_AUTH_TOKEN` to exercise protected operations with a sanitized bearer header; exact authenticated workflows remain in `test:api` because login tokens and order state are business fixtures.

To demonstrate layer diagnosis without leaving a defect active:

* An intentional schema defect is changing a response's documented field type. Schemathesis reports response-schema conformance and prints the reproducing operation, example, and seed.
* An intentional business defect is allowing an already-used idempotency key to create a second order. The deterministic API suite reports the exact HTTP sequence and expected `200` replay versus `201` creation.

Bearer values are never written to logs by the HTTP client or the CI wrapper. When reproducing a request locally, replace any authorization value with `<redacted>` before sharing the command.
