import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const repositoryRoot = resolve(
    dirname(new URL(import.meta.url).pathname),
    '../..',
);
const sbomPath = resolve(
    repositoryRoot,
    process.env.SBOM_PATH ?? 'artifacts/security/sbom.cdx.json',
);

const fail = (message) => {
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
};

if (!existsSync(sbomPath)) {
    fail(`SBOM not found at ${sbomPath}; run npm run sbom:generate first`);
} else {
    try {
        const document = JSON.parse(readFileSync(sbomPath, 'utf8'));
        const components = Array.isArray(document.components)
            ? document.components
            : [];
        if (
            document.bomFormat !== 'CycloneDX' ||
            typeof document.specVersion !== 'string' ||
            components.length === 0
        ) {
            throw new Error(
                'expected a CycloneDX document with at least one component',
            );
        }
        const names = new Set(
            components
                .map((component) => component.name)
                .filter((name) => typeof name === 'string'),
        );
        if (!names.has('jubilant-adventure'))
            throw new Error('workspace package jubilant-adventure is missing');
        process.stdout.write(
            `Valid CycloneDX ${document.specVersion} SBOM with ${components.length} components.\n`,
        );
    } catch (error) {
        fail(`Invalid SBOM: ${error instanceof Error ? error.message : error}`);
    }
}
