# State transitions: order lifecycle

## Preconditions

Create an order from the fixture cart and use the admin fixture for transitions.
The terminal states must be treated as states with no outgoing transitions.

## Task

Model every state/event pair in `reference.json`. Mark each transition as
allowed or rejected, including self-transitions and attempts after a terminal
state.

## Expected format

Return the stable case ID, starting state, event/target status, expected result
class, observed status, and resulting state.

## Hints

The route accepts a target status as its event. Walk an order through the
allowed path needed to reach a non-pending starting state before trying its
event.

## Relevant route/domain rule

`PATCH /orders/{id}/status` and `packages/shop-domain/src/services.ts`.
