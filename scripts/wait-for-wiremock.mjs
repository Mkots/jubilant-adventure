const baseUrl = process.env.WIREMOCK_URL ?? 'http://127.0.0.1:8080';
const healthUrl = `${baseUrl.replace(/\/$/, '')}/__admin/health`;
const deadline = Date.now() + 30_000;

while (Date.now() < deadline) {
    try {
        if ((await fetch(healthUrl)).ok) process.exit(0);
    } catch {
        // The container may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
}

throw new Error(`WireMock did not become ready at ${healthUrl}`);
