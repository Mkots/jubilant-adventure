import { readdir, readFile, writeFile } from 'node:fs/promises';

const main = async (): Promise<void> => {
    const directory = 'artifacts/allure/results';
    const files = (await readdir(directory).catch(() => [])).filter((file) =>
        file.endsWith('-result.json'),
    );
    const results = await Promise.all(
        files.map(
            async (file) =>
                JSON.parse(await readFile(`${directory}/${file}`, 'utf8')) as {
                    status?: string;
                    start?: number;
                    stop?: number;
                },
        ),
    );
    const counts = results.reduce<Record<string, number>>((acc, result) => {
        const status = result.status ?? 'unknown';
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
    }, {});
    const starts = results.map((result) => result.start ?? 0).filter(Boolean);
    const stops = results.map((result) => result.stop ?? 0).filter(Boolean);
    const durationMs =
        starts.length && stops.length
            ? Math.max(...stops) - Math.min(...starts)
            : 0;
    const summary = {
        total: results.length,
        passed: counts.passed ?? 0,
        failed: counts.failed ?? 0,
        broken: counts.broken ?? 0,
        skipped: counts.skipped ?? 0,
        durationMs,
    };
    await writeFile(
        'artifacts/allure/summary.json',
        `${JSON.stringify(summary, null, 2)}\n`,
    );
    process.stdout.write(
        `Allure suites: ${summary.total} total, ${summary.failed + summary.broken} failures, ${durationMs} ms.\n`,
    );
};

void main().catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
});
