# Frontend Testing

Web tests use the same reducer tree and RTK Query middleware as the application. `renderWithProviders` creates a fresh store and `MemoryRouter` for every test unless a test supplies an explicit store.

## Common patterns

```tsx
const view = renderWithProviders(<Component />, {
    preloadedState: { session: { token: null, user: null } },
    route: '/products?search=mug',
});

await view.user.click(screen.getByRole('button', { name: 'Refresh' }));
expect(view.store.getState().session.user).toBeNull();
```

MSW owns network behavior. Use `server.use(...)` for a one-test override; the setup resets handlers, DOM, and timers after each test. Add named reusable states to `src/testing/mocks/scenarios.ts` when a feature needs a loading, empty, validation, unauthorized, forbidden, or server-error response.

Tests should use roles, labels, visible text, and `user-event`. Do not mock selectors, dispatch, reducers, action creators, or generated RTK Query hooks.
