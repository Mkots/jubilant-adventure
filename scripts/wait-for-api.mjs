const baseUrl = process.env.API_HEALTH_URL ?? 'http://127.0.0.1:3412/health';
const attempts = Number.parseInt(process.env.API_HEALTH_ATTEMPTS ?? '60', 10);

const sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
        const response = await fetch(baseUrl);
        if (response.ok) {
            process.stdout.write('API test environment is ready\n');
            process.exit(0);
        }
    } catch {
        // The container may still be starting or waiting for the database.
    }
    await sleep(1000);
}

process.stderr.write(`API did not become ready after ${attempts} attempts\n`);
process.exit(1);
