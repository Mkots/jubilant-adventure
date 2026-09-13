# ZAP DAST

The repository runs OWASP ZAP Automation Framework scans against the real
disposable Hono API and the checked-in OpenAPI contract. The official scanner
image is pinned to `zaproxy/zap-stable:2.15.0`.

## Profiles

`baseline` imports `/openapi.json`, spiders the API, waits for passive scans,
and produces HTML and JSON reports. It is a pull-request gate with a short
time budget. `active` performs the same setup and a low-strength active scan;
it is manual or weekly scheduled only because it sends attack payloads.

Both profiles reset the disposable fixture before and after scanning. The
wrapper logs in as the fixture admin and injects the temporary bearer token
through a generated plan in a temporary directory. The token is never written
to the report directory or printed by the wrapper. Test-control credentials
remain environment variables and are not artifact data.

## Local run

```sh
npm run env:test:up
npm run test:security:zap:baseline
npm run test:security:zap:active
npm run env:test:down
```

`BASE_URL` is restricted to loopback by default. An explicitly approved
disposable host can be listed with `ZAP_ALLOWED_HOSTS=host`; use
`ZAP_ALLOW_UNSAFE_TARGET=1` only for a documented, authorized target.

Reports, result classification, and compose diagnostics are retained for 14
days in CI. The active profile treats the configured High-level exit status as
a gate. Security owners triage each alert by rule ID, risk, confidence,
endpoint, evidence, and remediation owner. A false positive or accepted risk
must include a narrow fingerprint/path, reason, owner, and review date in the
security exception record; broad scanner suppression is not permitted.

Reports older than 14 days are not a historical source of truth. Compare a
new result with the previous retained run and preserve a short triage note in
the issue or pull request that owns the remediation.
