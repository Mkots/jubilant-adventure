# Payment Resilience Testing

The resilience profile exercises the real API-to-payment network boundary:

```text
resilience-api -> toxiproxy -> wiremock
       |
       +-> postgres
```

The default API, E2E, WireMock contract, and performance profiles do not
require Toxiproxy. Start the isolated scenario with:

```bash
npm run env:resilience:up
npm run test:resilience:payment-timeout
npm run env:resilience:down
```

The test creates a `payment` proxy and a 450 ms downstream latency toxic while
the payment client timeout is 200 ms. It verifies the stable `504
payment_timeout` response, then removes the toxic and retries the same
idempotency key. The existing order is reused, stock is reserved once for the
successful attempt, and the successful replay does not call the gateway again.
Toxic and proxy cleanup runs in teardown even after an assertion failure.

This differs from a stubbed timeout unit test. A stub exercises application
error mapping directly; this scenario crosses the HTTP connection, proxy,
WireMock, timeout cancellation, database transaction, and retry path.

The test emits only correlation IDs, proxy state, and sanitized error text on
failure. The manual and weekly workflow stores service logs and Compose state
for 14 days, with a strict job timeout so a broken dependency cannot hang the
runner indefinitely.

Toxiproxy setup is deliberately explicit. The helper makes the proxy
idempotently, removes any stale named toxic, adds latency at 100% toxicity,
and deletes both the toxic and proxy during cleanup. The proxy is limited to
the payment upstream; no database or general service traffic is faulted.
