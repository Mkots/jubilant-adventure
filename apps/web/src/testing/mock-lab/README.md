# MSW vs Mirage Lab

This lab compares two ways to exercise the same cart request sequence:

1. `GET /api/cart` reads the initial cart.
2. `POST /api/cart/items` sets the mug quantity to `2`.
3. `GET /api/cart` reads the cart again.

The client uses real `fetch` requests in both variants. The MSW server returns deterministic responses from request handlers, so the second GET remains the initial quantity. The Mirage server owns users, products, carts, and cart items in an in-memory database, so the POST updates a relationship and the second GET observes the new quantity.

## Run It

```bash
npm run test:mock-lab --workspace apps/web
```

The lab has its own Vitest config and is not included by the normal frontend test command. Normal app tests and Storybook continue to use MSW; Mirage is not imported by application code or bundled into the app.

## Expected Signals

- The MSW test proves response control and handler reset, but not persistence.
- The Mirage test proves model relationships, factory-backed records, serializer configuration, mutation persistence, and `server.shutdown()` isolation.
- The second test in each block starts from quantity `1`, demonstrating between-test reset.

## Exercises

1. Change the MSW POST response without changing the GET handler. Observe that the next read is still fixed.
2. Add a second product and `cartItem` relationship to the Mirage seed data, then assert both items serialize through the cart endpoint.
3. Add a server error handler in each variant and compare how the failure is expressed.

| Concern | MSW | Mirage |
| --- | --- | --- |
| Best boundary | Individual network behavior | A small stateful fake backend |
| State | Explicit in handlers or fixtures | Models and relationships persist in memory |
| Reset | `resetHandlers()` restores handlers | `shutdown()` rebuilds the server in the next test |
| Maintenance | Low setup for one response or error | More setup, but useful for multi-step workflows |
| Scope here | Default application and Storybook tool | Dedicated teaching lab only |

Neither variant is a universal replacement for the other: the repository keeps MSW as the default and uses Mirage only where stateful fake-server behavior is the learning objective.
