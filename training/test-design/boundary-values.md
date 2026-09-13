# Boundary values: shop inputs

## Preconditions

Run the local API in test mode or use the executable reference validator. The
catalog is seeded with fixture version `v1`; a user account has the password
`password`.

## Task

Design cases around the smallest, largest, just-inside, and just-outside values
for cart quantity, product `page`, product `pageSize`, and the checkout
`idempotency-key` length. Keep transport failures separate from domain
conflicts.

## Expected format

Use the stable case IDs in `reference.json`. For each ID, record input,
predicted HTTP class, observed status, and the first useful diagnostic.

## Hints

Look at the schemas for `/products`, `/cart/items`, and `POST /orders`. A
boundary that passes schema validation can still reach a business conflict.

## Relevant routes

`GET /products`, `POST /cart/items`, `POST /orders`.
