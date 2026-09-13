# N+1 product lookup regression

This disposable patch replaces the single product-list read with one lookup
per returned item. The average catalog profile is the first detecting layer;
its JSON summary and request-duration trend are the diagnosis artifacts.

Apply the patch in an isolated worktree, run the disposable PostgreSQL
environment, and execute `npm run test:performance:smoke`. Remove the
worktree after the lesson. The patch is intentionally not part of the normal
test suite.
