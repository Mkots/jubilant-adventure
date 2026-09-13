import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const repositoryRoot = resolve(
    dirname(new URL(import.meta.url).pathname),
    '../..',
);
const artifactDirectory = resolve(repositoryRoot, 'artifacts/security');
const image = process.env.SYFT_IMAGE ?? 'anchore/syft:v1.20.0';
const outputPath = resolve(artifactDirectory, 'sbom.cdx.json');

mkdirSync(artifactDirectory, { recursive: true });

try {
    const output = execFileSync(
        'docker',
        [
            'run',
            '--rm',
            '-v',
            `${repositoryRoot}:/repo:ro`,
            image,
            'dir:/repo',
            '-o',
            'cyclonedx-json',
        ],
        { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    );
    writeFileSync(outputPath, output, 'utf8');
    process.stdout.write(`CycloneDX SBOM written to ${outputPath}\n`);
} catch (error) {
    process.stderr.write(
        `SBOM generation requires Docker and image ${image}. ${error instanceof Error ? error.message : error}\n`,
    );
    process.exitCode = 1;
}
