# Supply-chain security

The repository keeps the scanners complementary:

- `npm audit` reports advisories in npm dependency resolution and remains the
  fast dependency gate in the normal CI pipeline.
- CodeQL reports source-level data-flow and code patterns.
- Gitleaks scans all Git history for committed credentials. The committed
  `tests/security/fixtures/gitleaks-canary.env` contains only public AWS
  documentation values and is copied to a temporary path for the canary test.
- Trivy scans filesystem vulnerabilities/configuration and the built API test
  image. It fails on `CRITICAL` findings with a fix; unfixed findings are
  reported but do not fail the gate according to `security/scanner-policy.json`.
- Syft generates the dependency inventory as CycloneDX JSON from the workspace,
  including the package-lock-backed npm installation where catalogued.

## Local commands

```bash
npm run test:security:secrets
docker build --file docker/api-test.Dockerfile --tag jubilant-adventure:test .
npm run test:security:trivy
npm run sbom:generate
npm run sbom:validate
```

The scanner images are version-pinned in the scripts and workflow. Set
`GITLEAKS_IMAGE`, `TRIVY_IMAGE`, or `SYFT_IMAGE` only for an intentional local
tool update. Scanner output is written under `artifacts/security/`, which is
ignored by Git and retained in CI for 14 days.

## Exceptions

Exceptions belong in `security/scanner-policy.json` and must contain a narrow
fingerprint or path, the finding, owner, reason, and review date. Do not add a
broad directory, rule, or severity allowlist. Expired exceptions fail review
and must be removed or renewed with a new justification.
