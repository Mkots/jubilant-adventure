# Decision table: checkout

## Preconditions

The API is in test mode. Use the user fixture, a seeded cart, and a stable
idempotency key. Each row is evaluated independently.

## Task

Complete the checkout decision table using the condition columns in
`reference.json`: authentication, cart presence, stock availability, and
whether the idempotency key was already used. Predict the result and the
diagnostic that should be recorded.

## Expected format

Return one row per case ID with the condition values, expected result class,
observed status, and order/replay evidence where applicable.

## Hints

Evaluate authentication first. A replay is a successful no-op only after an
earlier successful checkout with the same user and key.

## Relevant route

`POST /orders`.
