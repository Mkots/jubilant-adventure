# Controlled failure lab

These snippets are isolated teaching examples. They are intentionally not
Vitest tests and are never imported by production code.

- `unfrozen-time.ts` shows why a clock must be injected before comparing dates.
- `shared-state.ts` shows a module singleton leaking state between examples.
- `async-wait.ts` shows an assertion running before a delayed state update.
- `order-dependence.ts` shows a test relying on a previous test's mutation.

Make each reproduction deterministic with a fake clock, explicit reset, a
promise barrier, or an isolated fixture. Do not convert these examples into
probabilistic default CI checks.
