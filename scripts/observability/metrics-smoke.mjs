const baseUrl = process.env.OBSERVABILITY_API_URL ?? 'http://127.0.0.1:3412';
const response = await fetch(`${baseUrl}/metrics`);
if (!response.ok)
    throw new Error(`Metrics endpoint returned ${response.status}`);
const body = await response.text();
for (const metric of [
    'http_requests_total',
    'http_request_errors_total',
    'http_request_duration_seconds_bucket',
]) {
    if (!body.includes(metric)) throw new Error(`Missing metric ${metric}`);
}
if (body.includes('correlationId') || body.includes('userId')) {
    throw new Error('Sensitive or high-cardinality labels found in metrics');
}
process.stdout.write('Observability metrics smoke passed\n');
