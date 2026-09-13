# Pact contracts

`npm run test:pact:consumer` writes `pacts/ReactShopClient-HonoShopApi.json`. The provider job consumes that exact file with `npm run test:pact:provider`; it does not use a Pact Broker, account, or secret.

Provider states are defined in `tests/pact/provider.test.ts` and only exist in the test process. Consumer interactions intentionally use type and variant matchers for required fields while leaving generated IDs and timestamps flexible.

When changing a contract, update the consumer interaction and provider state together, run both commands, and inspect whether the failure is an expectation change or a provider regression. CI passes the generated pact as an artifact between the two steps.
