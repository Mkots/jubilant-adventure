# Test reports

`npm run test:allure` runs the black-box API and local Playwright suites,
collects Allure results, sanitizes result JSON and text attachments, writes a
summary, and builds `artifacts/allure/report`. `npm run allure:generate` only
regenerates the static report from the sanitized result directory.

The API and browser adapters are disabled unless `ALLURE_RESULTS_DIR` is set,
so the ordinary test outcome and the fast `npm run ci` path do not depend on
Allure. Failed API exchanges, screenshots, traces, and videos are diagnostic
attachments; passing tests do not collect full payloads by default. Dummy
credentials are checked by `npm run test:allure-sanitizer`.

On pull requests, Actions writes suite totals, failures, duration, and links to
short-lived artifacts in the Job Summary. Sanitized results and browser
diagnostics are retained for 14 days. Fork pull requests have read-only
permissions and cannot deploy Pages. Only a trusted push to `main` deploys the
latest static report; deployment concurrency cancels older main runs so a late
workflow cannot replace a newer report.

For a local preview, run `npm run allure:generate` and open
`artifacts/allure/report/index.html`. `npm run check:published-report` verifies
the report has an index, no leak-canary values, and no missing local HTML
assets. If deployment fails, rerun the workflow from Actions after inspecting
the report artifact; no raw result branch or history mutation is required for
recovery.
