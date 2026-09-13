import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
    chmodSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { safePath } from '../lib/safe-env.mjs';
import { assertSafeSegment, resolveWithin } from '../lib/safe-path.mjs';

const profile = process.argv[2];
if (!['baseline', 'active'].includes(profile)) {
    process.stderr.write('Usage: npm run test:security:zap:baseline|active\n');
    process.exit(2);
}

const repository = resolve(new URL('../..', import.meta.url).pathname);
const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:3412';
const parsedUrl = new URL(baseUrl);
const allowedHosts = new Set(
    (process.env.ZAP_ALLOWED_HOSTS ?? '')
        .split(',')
        .map((host) => host.trim())
        .filter(Boolean),
);
const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1']);
const targetAllowed =
    ['http:', 'https:'].includes(parsedUrl.protocol) &&
    !parsedUrl.username &&
    !parsedUrl.password &&
    (loopbackHosts.has(parsedUrl.hostname) ||
        allowedHosts.has(parsedUrl.hostname));

if (!targetAllowed && process.env.ZAP_ALLOW_UNSAFE_TARGET !== '1') {
    process.stderr.write(
        'Refusing non-loopback BASE_URL. Use ZAP_ALLOWED_HOSTS or ZAP_ALLOW_UNSAFE_TARGET=1 for an explicit disposable target.\n',
    );
    process.exit(2);
}

const artifactDirectory = resolve(repository, 'artifacts/security/zap');
mkdirSync(artifactDirectory, { recursive: true });
chmodSync(artifactDirectory, 0o777);
const runId =
    process.env.ZAP_RUN_ID ??
    `zap-${Date.now()}-${randomBytes(4).toString('hex')}`;
assertSafeSegment(runId, 'ZAP_RUN_ID');
const image = process.env.ZAP_IMAGE ?? 'zaproxy/zap-stable:2.15.0';
const controlKey = process.env.TEST_CONTROL_KEY ?? 'performance-control';
const temporaryDirectory = mkdtempSync(
    resolve(artifactDirectory, '.tmp-jubilant-zap-'),
);
chmodSync(temporaryDirectory, 0o755);
const planTemplate = readFileSync(
    resolveWithin(repository, `security/zap/${profile}.yaml`, 'ZAP plan'),
    'utf8',
);
const plan = planTemplate
    .replaceAll('__TARGET_URL__', baseUrl.replace(/\/$/, ''))
    .replaceAll('__RUN_ID__', runId)
    .replaceAll('__AUTH_HEADER__', process.env.ZAP_AUTH_HEADER ?? '');
const planPath = resolveWithin(
    temporaryDirectory,
    `${profile}.yaml`,
    'ZAP plan output',
);
const openApiPath = resolveWithin(
    temporaryDirectory,
    'openapi.json',
    'OpenAPI output',
);
const resultPath = resolveWithin(
    artifactDirectory,
    `${profile}-result.json`,
    'ZAP result',
);
const reportPath = resolveWithin(
    artifactDirectory,
    `zap-${profile}-${runId}.json`,
    'ZAP report',
);
writeFileSync(planPath, plan);

const jsonResponse = async (url, options = {}) => {
    const response = await fetch(url, options);
    const body = await response.json().catch(() => undefined);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} from disposable API`);
    }
    return body;
};

const reset = async () => {
    await jsonResponse(`${baseUrl.replace(/\/$/, '')}/__test/reset`, {
        method: 'POST',
        headers: { 'X-Test-Control-Key': controlKey },
    });
};

let outcome = 'setup_failure';
let exitCode = 1;
let highAlerts = 0;
try {
    await jsonResponse(`${baseUrl.replace(/\/$/, '')}/health`);
    await reset();
    const login = await jsonResponse(
        `${baseUrl.replace(/\/$/, '')}/auth/login`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@example.test',
                password: 'password',
            }),
        },
    );
    if (typeof login?.token !== 'string' || login.token.length === 0) {
        throw new Error('Disposable API did not return an auth token');
    }
    const authenticatedPlan = plan.replaceAll(
        '__AUTH_HEADER__',
        `Bearer ${login.token}`,
    );
    writeFileSync(planPath, authenticatedPlan);
    const openApi = await fetch(`${baseUrl.replace(/\/$/, '')}/openapi.json`);
    if (!openApi.ok) throw new Error('Disposable API OpenAPI export failed');
    writeFileSync(openApiPath, await openApi.text());

    const dockerArguments = [
        'run',
        '--rm',
        '--network',
        'host',
        '-v',
        `${temporaryDirectory}:/zap/wrk:ro`,
        '-v',
        `${artifactDirectory}:/zap/out`,
        image,
        'zap.sh',
        '-cmd',
        '-autorun',
        `/zap/wrk/${profile}.yaml`,
    ];
    const result = spawnSync('docker', dockerArguments, {
        cwd: repository,
        stdio: 'inherit',
        shell: false,
        env: { ...process.env, PATH: safePath(repository) },
    });
    exitCode = result.error ? 1 : (result.status ?? 1);
    if (existsSync(reportPath)) {
        const report = JSON.parse(readFileSync(reportPath, 'utf8'));
        const alerts = report.site?.flatMap((site) => site.alerts ?? []) ?? [];
        highAlerts = alerts.filter((alert) => {
            const risk = String(alert.riskdesc ?? '').toLowerCase();
            return risk.startsWith('high') || risk.startsWith('critical');
        }).length;
    }
    outcome =
        exitCode === 1 ? 'zap_error' : highAlerts > 0 ? 'alert_gate' : 'passed';
} catch (error) {
    process.stderr.write(
        `${error instanceof Error ? error.message : 'ZAP setup failed'}\n`,
    );
} finally {
    await reset().catch(() => undefined);
    rmSync(temporaryDirectory, { recursive: true, force: true });
}

writeFileSync(
    resultPath,
    `${JSON.stringify(
        {
            profile,
            outcome,
            exitCode,
            image,
            runId,
            highAlerts,
            reportFile: existsSync(reportPath)
                ? `zap-${profile}-${runId}.json`
                : undefined,
            reportDirectory: 'artifacts/security/zap',
            generatedAt: new Date().toISOString(),
        },
        null,
        2,
    )}\n`,
);
if (outcome !== 'passed') {
    process.stderr.write(`ZAP ${profile} failed with ${outcome}\n`);
}
process.exitCode = outcome === 'passed' ? 0 : 1;
