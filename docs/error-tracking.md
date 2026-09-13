# Error Tracking Lab

Sentry is optional in both applications. The backend uses `SENTRY_DSN`; the
frontend uses `VITE_SENTRY_DSN`. Empty values keep error tracking disabled.
Events are scrubbed before sending: request and user objects are removed,
credentials and payment fields are redacted, breadcrumbs keep messages but
drop data, and tracing is disabled for Sentry to control volume.

## Local verification

The controlled verification is opt-in and requires a non-production test
control key plus a Sentry project URL:

```bash
SENTRY_VERIFY_URL=http://localhost:3000/__test/error \
TEST_CONTROL_KEY=local-test-control \
npm run error-tracking:verify
```

The command only checks that the controlled endpoint returns a server error;
it does not print DSNs or auth tokens. Without `SENTRY_VERIFY_URL` it exits
successfully with a skip message.

Source maps are uploaded only by an explicit command after a release build:

```bash
SENTRY_RELEASE=jubilant-adventure@local \
SENTRY_AUTH_TOKEN="$SENTRY_AUTH_TOKEN" \
npm run error-tracking:upload-sourcemaps
```

The uploader requires `SENTRY_ORG`, `SENTRY_PROJECT`, and
`SENTRY_AUTH_TOKEN`, passes the release explicitly, and never writes the token
to repository files. The Sentry free tier is suitable for this bounded lab;
set a short retention policy and remove test events/releases during cleanup.
