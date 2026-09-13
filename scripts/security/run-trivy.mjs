import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const repositoryRoot = resolve(
    dirname(new URL(import.meta.url).pathname),
    '../..',
);
const artifactDirectory = resolve(repositoryRoot, 'artifacts/security');
const cacheDirectory = resolve(repositoryRoot, 'docker-data/trivy-cache');
const image = process.env.TRIVY_IMAGE ?? 'aquasec/trivy:0.61.0';
const policy = JSON.parse(
    readFileSync(
        resolve(repositoryRoot, 'security/scanner-policy.json'),
        'utf8',
    ),
).trivy;

mkdirSync(artifactDirectory, { recursive: true });
mkdirSync(cacheDirectory, { recursive: true });

const scannerArguments = [
    '--scanners',
    policy.scanTypes.join(','),
    '--severity',
    policy.failSeverities.join(','),
    '--ignore-unfixed',
    '--exit-code',
    '1',
];

const run = (args) => {
    try {
        execFileSync('docker', args, {
            cwd: repositoryRoot,
            stdio: 'inherit',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Trivy requires Docker and image ${image}. ${message}`);
    }
};

const ensureImage = () => {
    try {
        execFileSync(
            'docker',
            ['image', 'inspect', 'jubilant-adventure:test'],
            {
                cwd: repositoryRoot,
                stdio: 'ignore',
            },
        );
    } catch {
        process.stdout.write(
            'Building missing jubilant-adventure:test image.\n',
        );
        execFileSync(
            'docker',
            [
                'build',
                '--file',
                'docker/api-test.Dockerfile',
                '--tag',
                'jubilant-adventure:test',
                '.',
            ],
            { cwd: repositoryRoot, stdio: 'inherit' },
        );
    }
};

try {
    ensureImage();
    run([
        'run',
        '--rm',
        '-v',
        `${repositoryRoot}:/repo:ro`,
        '-v',
        `${artifactDirectory}:/artifacts`,
        '-v',
        `${cacheDirectory}:/root/.cache`,
        image,
        'fs',
        '--format',
        'json',
        '--output',
        '/artifacts/trivy-filesystem.json',
        ...scannerArguments,
        '--skip-dirs',
        '/repo/.git,/repo/node_modules',
        '/repo',
    ]);

    const imageTar = `${artifactDirectory}/.api-test-image.tar`;
    try {
        execFileSync(
            'docker',
            ['save', '--output', imageTar, 'jubilant-adventure:test'],
            {
                cwd: repositoryRoot,
                stdio: 'inherit',
            },
        );
        run([
            'run',
            '--rm',
            '-v',
            `${artifactDirectory}:/scan:ro`,
            '-v',
            `${artifactDirectory}:/artifacts`,
            '-v',
            `${cacheDirectory}:/root/.cache`,
            image,
            'image',
            '--input',
            '/scan/.api-test-image.tar',
            '--format',
            'json',
            '--output',
            '/artifacts/trivy-image.json',
            ...scannerArguments,
        ]);
    } finally {
        rmSync(imageTar, { force: true });
    }
    const databaseMetadata = JSON.parse(
        readFileSync(resolve(cacheDirectory, 'trivy/db/metadata.json'), 'utf8'),
    );
    const checksMetadata = JSON.parse(
        readFileSync(
            resolve(cacheDirectory, 'trivy/policy/metadata.json'),
            'utf8',
        ),
    );
    writeFileSync(
        resolve(artifactDirectory, 'scanner-metadata.json'),
        JSON.stringify(
            {
                scannedAt: new Date().toISOString(),
                trivyImage: image,
                policy,
                database: databaseMetadata,
                checksBundle: checksMetadata,
            },
            null,
            4,
        ),
        'utf8',
    );
    process.stdout.write('Trivy filesystem and container scans passed.\n');
} catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
}
