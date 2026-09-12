# Story Coverage Map

Storybook stories make the important UI states reproducible without a live API. The existing component tests continue to cover domain edge cases and exact request contracts; story `play` functions only prove the defining interaction for each visible state.

| Surface | State stories | Defining interaction | Complementary test coverage |
| --- | --- | --- | --- |
| Products | Default, Loading, Empty, Error, LongContent, KeyboardFocus | Search submission and anonymous add-to-cart guard | `products.test.tsx` covers query serialization, retry, pagination, and stock |
| Product detail | Default, Loading, Error, LongContent, KeyboardFocus | Keyboard reachability and add-to-cart guard | `products.test.tsx` covers generated route data |
| Cart | Default, Empty, Loading, Error, LongContent, KeyboardFocus | Quantity control focus and mutation boundary | `cartCheckout.test.tsx` covers totals, conflicts, and shared store state |
| Checkout | Default, Loading, Error, ValidationFocus, NarrowViewport | Validation focus and submit states | `cartCheckout.test.tsx` covers idempotent retry and duplicate-submit prevention |
| Login | Default, Loading, InvalidCredentials, SignedIn, KeyboardFocus | Login request and field-error announcement | `authOrders.test.tsx` covers redirect, persistence, and logout |
| Orders | Default, Loading, Forbidden, SessionExpired, LongContent | Admin status transition | `authOrders.test.tsx` covers ownership, missing orders, and rejected status updates |

Each story receives a fresh Redux store from the global Storybook decorator. Network responses are supplied through MSW handlers, while the cart's local query cache is seeded only for the loaded cart stories because the production API currently exposes cart writes, not a cart-read endpoint.
