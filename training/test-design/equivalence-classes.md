# Equivalence classes: shop requests

## Preconditions

Use fixture version `v1` and reset the test API between cases. Do not reuse a
token when the case changes the actor class.

## Task

Partition credentials, roles, product existence and stock, and request shape
into classes that should behave alike. Choose one representative from each
class and explain why it is sufficient.

## Expected format

For every ID in `reference.json`, record the partition, representative input,
expected HTTP class, observed status, and whether the request reached a domain
rule.

## Hints

Separate malformed input from valid input with invalid credentials. For stock,
compare a quantity that fits with one that exceeds the seeded product stock.

## Relevant routes

`POST /auth/login`, `GET /products/{id}`, `POST /cart/items`.
