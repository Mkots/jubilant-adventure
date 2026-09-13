import { readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { resolveWithin } from '../lib/safe-path.mjs';

const reportRoot = resolveWithin(
    process.cwd(),
    process.argv[2] ?? 'artifacts/allure/report',
    'Allure report root',
);
const files = async (directory: string): Promise<string[]> => {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map((entry) => {
            const path = resolveWithin(
                directory,
                entry.name,
                'Allure report entry',
            );
            return entry.isDirectory() ? files(path) : [path];
        }),
    );
    return nested.flat();
};

const main = async (): Promise<void> => {
    const reportFiles = await files(reportRoot);
    const known = new Set(
        reportFiles.map((file) => relative(reportRoot, file)),
    );
    const htmlFiles = reportFiles.filter((file) => file.endsWith('.html'));
    const references = /(?:src|href)=["']([^"']+)["']/g;
    for (const file of htmlFiles) {
        const html = await readFile(file, 'utf8');
        if (
            /canary-|dummy-(?:access-token|secret-password|cookie-value)/i.test(
                html,
            )
        ) {
            throw new Error(
                `Sensitive leak detected in ${relative(reportRoot, file)}`,
            );
        }
        for (const match of html.matchAll(references)) {
            const target = match[1];
            if (
                !target ||
                target.startsWith('http') ||
                target.startsWith('#') ||
                target.startsWith('data:')
            )
                continue;
            const cleanTarget = target.split(/[?#]/, 1)[0];
            const resolved = relative(
                resolve(reportRoot),
                resolveWithin(
                    reportRoot,
                    relative(reportRoot, resolve(dirname(file), cleanTarget)),
                    'Allure report asset',
                ),
            );
            if (!known.has(resolved)) {
                throw new Error(
                    `Broken report asset ${target} referenced by ${relative(reportRoot, file)}`,
                );
            }
        }
    }
    if (!known.has('index.html'))
        throw new Error(`No index.html found in ${reportRoot}`);
    process.stdout.write(
        `Published report is self-contained: ${reportFiles.length} files checked.\n`,
    );
};

void main().catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
});
