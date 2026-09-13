# SonarQube Lab

SonarQube Cloud is the shared result. The repository workflow runs only when a
token is available and never fails fork pull requests because protected secrets
are unavailable. Coverage comes from the existing LCOV reports; Biome,
TypeScript, CodeQL, Codecov, and Sonar have separate documented roles.

Run the repository-only checks locally:

```bash
npm run test:coverage
npm run sonar:validate-config
npm run sonar:local:up
npm run sonar:local:scan
```

The local Community Build profile is optional and uses at least 2 GB memory.
The default `npm run ci` does not start it. Set `SONAR_TOKEN` in the shell for
the scanner; never put it in `.env`, properties, or reports.

## TypeScript 7 compatibility pilot

The compatibility pilot was recorded on 2026-09-13 against TypeScript
`7.0.2`. Configuration validation, LCOV path resolution, and the local scanner
entrypoint are repository-compatible. Cloud analysis remains non-required
until the organization owner confirms parser issue quality on the public
project. Any parser failure or false-positive cluster is recorded before a
required status is considered.

See `training/sonarqube/remediation.md` for a small finding-to-remediation
exercise.
