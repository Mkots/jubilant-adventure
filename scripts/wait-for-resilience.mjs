const apiUrl = process.env.RESILIENCE_API_URL ?? 'http://127.0.0.1:3413';
const wiremockUrl = process.env.WIREMOCK_URL ?? 'http://127.0.0.1:8080';
const toxiproxyUrl = process.env.TOXIPROXY_URL ?? 'http://127.0.0.1:8474';
const deadline = Date.now() + 60_000;

const ready = async (url) => {
    try {
        return (await fetch(url, { signal: AbortSignal.timeout(2_000) })).ok;
    } catch {
        return false;
    }
};

while (Date.now() < deadline) {
    const [api, wiremock, toxiproxy] = await Promise.all([
        ready(`${apiUrl.replace(/\/$/, '')}/health`),
        ready(`${wiremockUrl.replace(/\/$/, '')}/__admin/health`),
        ready(`${toxiproxyUrl.replace(/\/$/, '')}/version`),
    ]);
    if (api && wiremock && toxiproxy) {
        process.stdout.write('Resilience test environment is ready\n');
        process.exit(0);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
}

throw new Error('Resilience test environment did not become ready in 60s');
