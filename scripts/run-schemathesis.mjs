import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdir } from 'node:fs/promises';
import process from 'node:process';

const root = new URL('..', import.meta.url).pathname;
const spec =
    process.env.SCHEMATHESIS_SPEC ?? 'http://127.0.0.1:3412/openapi.json';
const baseUrl = process.env.SCHEMATHESIS_BASE_URL ?? 'http://127.0.0.1:3412';
const reportDir = process.env.SCHEMATHESIS_REPORT_DIR ?? 'artifacts';
const report = `${reportDir}/schemathesis.junit.xml`;

const candidates = [
    process.env.SCHEMATHESIS_BIN,
    `${root}.venv/bin/schemathesis`,
    'schemathesis',
].filter(Boolean);

const findExecutable = async () => {
    for (const candidate of candidates) {
        try {
            await access(candidate, constants.X_OK);
            return candidate;
        } catch {
            if (candidate === 'schemathesis') return candidate;
        }
    }
    return undefined;
};

const executable = await findExecutable();
if (!executable) {
    // biome-ignore lint/suspicious/noConsole: CLI diagnostics belong in stderr
    console.error(
        'Schemathesis is not installed. Run: python -m pip install schemathesis',
    );
    process.exit(1);
}

await mkdir(reportDir, { recursive: true });
const args = [
    'run',
    spec,
    '--url',
    baseUrl,
    '--checks',
    'not_a_server_error,status_code_conformance,content_type_conformance,response_schema_conformance',
    '--phases',
    'coverage,fuzzing',
    '--seed',
    '20260912',
    '--max-examples',
    '20',
    '--max-time',
    '10',
    '--request-timeout',
    '1',
    '--report',
    'junit',
    '--report-junit-path',
    report,
    '--output-sanitize',
    'true',
];

if (process.env.SCHEMATHESIS_AUTH_TOKEN) {
    args.push(
        '--header',
        `Authorization:Bearer ${process.env.SCHEMATHESIS_AUTH_TOKEN}`,
    );
}

const child = spawn(executable, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
});
child.on('error', (error) => {
    // biome-ignore lint/suspicious/noConsole: CLI diagnostics belong in stderr
    console.error(`Could not start Schemathesis: ${error.message}`);
    process.exitCode = 1;
});
child.on('exit', (code, signal) => {
    process.exitCode = signal ? 1 : (code ?? 1);
});
