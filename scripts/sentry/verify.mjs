const url = process.env.SENTRY_VERIFY_URL;
if (!url) {
    process.stdout.write(
        'Set SENTRY_VERIFY_URL to run the bounded controlled-error verification; configuration is present.',
    );
    process.exit(0);
}
for (const name of [
    'SENTRY_AUTH_TOKEN',
    'SENTRY_ORG',
    'SENTRY_PROJECT',
    'SENTRY_RELEASE',
]) {
    if (!process.env[name])
        throw new Error(`${name} is required when SENTRY_VERIFY_URL is set`);
}
const response = await fetch(url, {
    headers: { 'x-test-control-key': process.env.TEST_CONTROL_KEY ?? '' },
});
if (response.status < 500)
    throw new Error(
        `Verification endpoint returned ${response.status}; expected controlled 5xx`,
    );
process.stdout.write(
    'Sentry verification scenario triggered; inspect the configured release in Sentry Cloud.',
);
