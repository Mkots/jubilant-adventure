import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

const repositoryRoot = resolve(
    dirname(new URL(import.meta.url).pathname),
    '../..',
);
const configPath = resolve(repositoryRoot, '.gitleaks.toml');
const fixturePath = resolve(
    repositoryRoot,
    'tests/security/fixtures/gitleaks-canary.env',
);
const image = process.env.GITLEAKS_IMAGE ?? 'zricethezav/gitleaks:v8.24.3';

const docker = (args, options = {}) => {
    try {
        return execFileSync('docker', args, {
            cwd: repositoryRoot,
            encoding: 'utf8',
            maxBuffer: 4 * 1024 * 1024,
            stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
        });
    } catch (error) {
        if (
            options.allowFailure &&
            typeof error === 'object' &&
            error !== null &&
            'status' in error &&
            typeof error.status === 'number'
        )
            return undefined;
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
            `Gitleaks requires Docker and image ${image}. ${message}`,
        );
    }
};

const runCanary = () => {
    const temporaryDirectory = mkdtempSync(`${tmpdir()}/jubilant-gitleaks-`);
    try {
        writeFileSync(
            resolve(temporaryDirectory, 'canary.env'),
            readFileSync(fixturePath),
            'utf8',
        );
        const result = docker(
            [
                'run',
                '--rm',
                '-v',
                `${temporaryDirectory}:/scan:ro`,
                '-v',
                `${configPath}:/config.toml:ro`,
                image,
                'dir',
                '--source',
                '/scan',
                '--config',
                '/config.toml',
                '--no-banner',
                '--redact',
                '--exit-code',
                '1',
            ],
            { capture: true, allowFailure: true },
        );
        if (result !== undefined) {
            throw new Error('Gitleaks canary unexpectedly passed');
        }
        process.stdout.write('Gitleaks canary detected as expected.\n');
    } finally {
        rmSync(temporaryDirectory, { recursive: true, force: true });
    }
};

const runRepositoryScan = () => {
    docker([
        'run',
        '--rm',
        '-v',
        `${repositoryRoot}:/repo:ro`,
        image,
        'git',
        '--config',
        '/repo/.gitleaks.toml',
        '--log-opts=--all',
        '--no-banner',
        '--redact',
        '--exit-code',
        '1',
        '/repo',
    ]);
    process.stdout.write('Gitleaks history scan passed.\n');
};

try {
    runCanary();
    runRepositoryScan();
} catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
}
