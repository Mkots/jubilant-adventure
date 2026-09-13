# Performance testing

The performance suite exercises the real Hono API with PostgreSQL. It is
designed for a disposable loopback environment and does not target shared or
production systems by default.

## Baseline

| Item | Reference value |
| --- | --- |
| API | Node 24.20.0, `docker/api-test.Dockerfile` |
| Database | PostgreSQL 16.4 Alpine |
| Load runner | `grafana/k6:0.55.2` |
| Smoke gate | HTTP errors `< 2%`, business p95 `< 800 ms` |
| Average gate | HTTP errors `< 5%`, business p95 `< 1000 ms` |
| State | `v1` baseline fixture, reset before and after each run |

The thresholds are an initial local reference baseline, not a capacity claim.
Record machine class, Docker version, profile, run ID, and the JSON summary
when comparing a later run. A threshold failure is a regression signal to
triage with the owning API or database team; it is not silently accepted by
the workflow.

## Local run

```sh
npm run env:test:up
npm run test:performance:smoke
npm run test:performance:average
npm run env:test:down
```

The wrapper uses the pinned k6 image and writes one JSON and one JUnit summary
per profile under `artifacts/performance/`. Results distinguish setup failure,
functional check failure, threshold failure, and pass. The run namespace is
passed into idempotency and correlation keys, with VU and iteration suffixes,
so concurrent disposable runs cannot replay each other's business requests.

`BASE_URL` must resolve to `127.0.0.1`, `localhost`, or `::1`. An explicitly
approved disposable host may be added with `K6_ALLOWED_HOSTS=host`; the
escape hatch `K6_ALLOW_UNSAFE_TARGET=1` is intentionally visible in the shell
command and should never be used for a production URL. Credentials and test
control keys are not written to summaries.

## Coverage and follow-up

Smoke covers catalog, login, cart, checkout, and an idempotent replay. Average
load separates catalog browsing from a bounded checkout flow so the finite
fixture stock does not turn a load test into an accidental stock test. Setup
and teardown are serialized by the API control queue and no reset is issued
during active load.

The suite is scheduled manually or weekly because it needs Docker and a
disposable database; it is not a pull-request latency gate. Short spike and
soak runs remain deliberate follow-up experiments and should retain their
raw runner output alongside the summaries.

The intentional N+1 regression is kept in the defect catalog as
`performance-n-plus-one`. Apply it only in a disposable worktree, start the
performance environment, and expect the named performance command to fail;
never commit the patch to the production branch.
