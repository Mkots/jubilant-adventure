import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

const reportRoot = process.argv[2] ?? 'artifacts/allure/report';
const files = async (directory: string): Promise<string[]> => {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map((entry) => {
            const path = join(directory, entry.name);
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
                resolve(dirname(file), cleanTarget),
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
