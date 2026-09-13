import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const profiles = new Set(['smoke', 'average']);
const profile = process.argv[2];
if (!profiles.has(profile)) {
    process.stderr.write('Usage: npm run test:performance:smoke|average\n');
    process.exit(2);
}

const repository = resolve(new URL('../..', import.meta.url).pathname);
const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:3412';
const parsedUrl = new URL(baseUrl);
const allowedHosts = new Set(
    (process.env.K6_ALLOWED_HOSTS ?? '')
        .split(',')
        .map((host) => host.trim())
        .filter(Boolean),
);
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1']);
const isAllowedTarget =
    ['http:', 'https:'].includes(parsedUrl.protocol) &&
    !parsedUrl.username &&
    !parsedUrl.password &&
    (loopbackHosts.has(parsedUrl.hostname) ||
        allowedHosts.has(parsedUrl.hostname));

if (!isAllowedTarget && process.env.K6_ALLOW_UNSAFE_TARGET !== '1') {
    process.stderr.write(
        'Refusing non-loopback BASE_URL. Use K6_ALLOWED_HOSTS or K6_ALLOW_UNSAFE_TARGET=1 for an explicit disposable target.\n',
    );
    process.exit(2);
}

const artifactDirectory = resolve(repository, 'artifacts/performance');
mkdirSync(artifactDirectory, { recursive: true });
const runId =
    process.env.K6_RUN_ID ??
    `k6-${Date.now()}-${randomBytes(4).toString('hex')}`;
const summaryBasename = `${profile}-${runId}`;
const image = process.env.K6_IMAGE ?? 'grafana/k6:0.55.2';
const scriptDirectory = resolve(repository, 'tests/performance/k6');
const dockerArguments = [
    'run',
    '--rm',
    '--network',
    'host',
    '-v',
    `${scriptDirectory}:/scripts:ro`,
    '-v',
    `${artifactDirectory}:/artifacts`,
    '-e',
    `BASE_URL=${baseUrl}`,
    '-e',
    `K6_PROFILE=${profile}`,
    '-e',
    `K6_RUN_ID=${runId}`,
    '-e',
    `K6_SUMMARY_BASENAME=${summaryBasename}`,
    '-e',
    `K6_ALLOWED_HOSTS=${process.env.K6_ALLOWED_HOSTS ?? ''}`,
    '-e',
    `K6_ALLOW_UNSAFE_TARGET=${process.env.K6_ALLOW_UNSAFE_TARGET ?? ''}`,
    '-e',
    `TEST_CONTROL_KEY=${process.env.TEST_CONTROL_KEY ?? 'performance-control'}`,
    image,
    'run',
    '--summary-trend-stats=avg,min,med,max,p(90),p(95)',
    '/scripts/shop.js',
];

const result = spawnSync('docker', dockerArguments, {
    cwd: repository,
    stdio: 'inherit',
    env: process.env,
});
const summaryPath = resolve(artifactDirectory, `${summaryBasename}.json`);
const exitCode = result.error ? 1 : (result.status ?? 1);
let summary;
if (existsSync(summaryPath)) {
    summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
}

const outcome =
    summary?.outcome ?? (exitCode === 0 ? 'passed' : 'setup_failure');
writeFileSync(
    resolve(artifactDirectory, `${profile}-result.json`),
    `${JSON.stringify(
        {
            profile,
            outcome,
            exitCode,
            summaryFile: `${summaryBasename}.json`,
            generatedAt: new Date().toISOString(),
        },
        null,
        2,
    )}\n`,
);

if (result.error) {
    process.stderr.write(
        `Could not start pinned k6 image: ${result.error.message}\n`,
    );
}
if (outcome !== 'passed' || exitCode !== 0) {
    process.stderr.write(`Performance ${profile} failed with ${outcome}\n`);
}
process.exitCode = outcome === 'passed' && exitCode === 0 ? 0 : 1;
