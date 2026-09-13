# E2E integration defect

The browser client uses a route that the local API does not serve. Start with
the first failed network request and compare the browser base URL with the
Playwright proxy configuration.
