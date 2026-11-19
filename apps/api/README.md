# API workspace

Start the local API with:

```bash
npm run start --workspace apps/api
```

The server listens on `PORT` when configured and otherwise uses port `3000`.

Routes can be tested without opening a socket by importing `app` and calling
`app.request()` from Vitest. The Node adapter is covered separately with an
ephemeral port smoke test.

The generated OpenAPI 3.1 contract is available at `/openapi.json` and Swagger
UI is available at `/docs`. Add business routes with `createRoute` and
`app.openapi`; the contract inventory test rejects reachable undocumented
`/auth`, `/products`, `/cart`, `/orders`, or `/users` routes.

## User accounts

The `users` endpoints let tests create a player and bring it to a known state
using only the API:

| Step | Request | Who | Result |
| --- | --- | --- | --- |
| Create | `POST /users` | anyone | `201`, `status: "pending_verification"` |
| Log in | `POST /auth/login` | the new user | bearer token |
| Verify | `POST /users/{id}/verification` | user with `{ code }`, or admin with no body | `202`, `status: "verifying"` |
| Set balance | `PUT /users/{id}/balance` `{ amount }` | admin, verified user only | `200` |
| Grant bonus | `POST /users/{id}/bonuses` `{ code, amount }` | admin, verified user only | `202`, bonus `status: "pending"` |
| Set limits | `PUT /users/{id}/limits` | the user or admin | `200` |
| Read state | `GET /users/{id}`, `GET /users/me` | the user or admin | `200` |

Amounts are integer minor units of the account currency (`USD` unless
`currency` is set at registration). Registration requires an age of 18 or
older when `dateOfBirth` is given. Omitted or `null` limit fields remove that
limit. The daily deposit limit cannot be above the weekly one, and the weekly
cannot be above the monthly.

Verification and bonus activation finish in the background after a random
delay (`500-2500` ms by default). Clients must poll `GET /users/{id}` until
`status` is `"verified"` or the bonus is `"active"`. Its amount is then
included in `bonusBalance`. Set `ACCOUNT_PROCESSING_DELAY_MS` to a fixed value
(`1000`) or a range (`200-800`) to change the delay.

In test mode, `GET /__test/users/{id}/verification-code` with the
`X-Test-Control-Key` header returns the code that would be emailed, so the user
can verify themselves. `POST /__test/reset` removes registered users.
Fixture users such as `user@example.test` already have a verified `USD`
account.
