const checks = [
    [
        'API',
        process.env.OBSERVABILITY_API_URL ?? 'http://127.0.0.1:3412/health',
    ],
    ['Prometheus', 'http://127.0.0.1:9090/-/ready'],
    ['Tempo', 'http://127.0.0.1:3200/ready'],
    ['Grafana', 'http://127.0.0.1:3001/api/health'],
];

const timeoutMs = 120_000;
const startedAt = Date.now();
while (Date.now() - startedAt < timeoutMs) {
    const statuses = await Promise.all(
        checks.map(async ([, url]) => {
            try {
                const response = await fetch(url, {
                    signal: AbortSignal.timeout(2_000),
                });
                return response.ok;
            } catch {
                return false;
            }
        }),
    );
    if (statuses.every(Boolean)) process.exit(0);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
}

process.stderr.write(
    'Observability profile did not become ready within two minutes\n',
);
process.exit(1);
