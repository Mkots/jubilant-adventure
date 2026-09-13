import { spawn } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';

const run = (
    command: string,
    args: string[],
    env: Record<string, string>,
): Promise<void> =>
    new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: 'inherit',
            env: { ...process.env, ...env },
        });
        child.once('error', reject);
        child.once('exit', (code) =>
            code === 0
                ? resolve()
                : reject(new Error(`${command} exited with ${code}`)),
        );
    });

const main = async (): Promise<void> => {
    const root = 'artifacts/allure';
    const raw = `${root}/raw`;
    await rm(root, { recursive: true, force: true });
    await mkdir(raw, { recursive: true });
    let failed = false;
    for (const [command, args, env] of [
        ['npm', ['run', 'test:api'], { ALLURE_RESULTS_DIR: `${raw}/api` }],
        ['npm', ['run', 'test:e2e'], { ALLURE_RESULTS_DIR: `${raw}/e2e` }],
    ] as const) {
        try {
            await run(command, args, env);
        } catch (error) {
            failed = true;
            process.stderr.write(`${String(error)}\n`);
        }
    }
    await rm(`${root}/results`, { recursive: true, force: true });
    for (const suite of ['api', 'e2e']) {
        const sanitizedSuite = `${root}/sanitized-${suite}`;
        await run(
            'tsx',
            [
                'scripts/allure/sanitize-results.ts',
                `${raw}/${suite}`,
                sanitizedSuite,
            ],
            {},
        );
        await cp(sanitizedSuite, `${root}/results`, {
            recursive: true,
            force: true,
        });
        await rm(sanitizedSuite, { recursive: true, force: true });
    }
    await run('tsx', ['scripts/allure/summary.ts'], {});
    await run('npm', ['run', 'allure:generate'], {});
    if (failed) throw new Error('One or more Allure suites failed');
};

void main().catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
});
