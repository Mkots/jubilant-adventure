import { sanitizeAllureResults } from './sanitizer';

const main = async (): Promise<void> => {
    const input = process.argv[2] ?? 'artifacts/allure/raw';
    const output = process.argv[3] ?? 'artifacts/allure/results';
    const summary = await sanitizeAllureResults(input, output);
    process.stdout.write(
        `Sanitized ${summary.results} result files and ${summary.attachments} attachments.\n`,
    );
};

void main().catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
});
