# Observability Lab

The API emits a bounded correlation ID on every response. In `test` and
`production` modes logs are JSON objects with `event`, `timestamp`, `level`,
`service`, `method`, `route`, `status`, `durationMs`, `correlationId`, and any
available `traceId`/`spanId`. Development uses the same fields with a readable
formatter. Authorization, cookies, credentials, tokens, payment data, bodies,
and high-risk query values are redacted centrally.

## Local profile

Start the pinned Prometheus, Grafana, Tempo, WireMock, API, and PostgreSQL services:

```bash
OTEL_MODE=otlp npm run observability:up
```

Grafana is available at `http://localhost:3001`, Prometheus at
`http://localhost:9090`, and Tempo at `http://localhost:3200`. The dashboard is
provisioned as code and contains request rate, 5xx ratio, p50/p95/p99 latency,
status groups, and selected route comparisons. A sustained 5xx or p95 breach
appears in Prometheus alert state.

Run a short k6 load and check the metrics path:

```bash
npm run test:performance:smoke
npm run test:observability:metrics
npm run test:observability:trace
npm run observability:down
```

The trace smoke uses the controlled shop fixture, returns `X-Trace-Id` only
when `x-diagnostic-trace` is requested outside production, and polls Tempo for
at most one minute. The resulting trace includes the API request, checkout,
database/application operation, and payment span. `docker compose ... down -v`
removes the ephemeral local observability data.

## Failure workflow

Use the correlation ID from an API response or test artifact to find the JSON
request lifecycle. When tracing is enabled, use its trace ID in Grafana Explore
to compare the server, database, and payment timings. API and browser test
helpers should retain these IDs in failure output instead of logging request
payloads.
