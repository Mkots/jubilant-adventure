import { execFile } from 'node:child_process';
import {
    mkdtemp,
    readdir,
    readFile,
    symlink,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const repo = process.cwd();
type Defect = {
    id: string;
    concept: string;
    prerequisites: string;
    patch: string;
    apply: string;
    expectedCommand: string[];
    detectingLayer: string;
    diagnosisArtifact: string;
    cleanup: string;
};

const main = async (): Promise<void> => {
    const directories = (
        await readdir('training/defects', { withFileTypes: true })
    )
        .filter((entry) => entry.isDirectory() && entry.name !== 'lab')
        .map((entry) => entry.name)
        .sort();
    const defects = await Promise.all(
        directories.map(
            async (directory) =>
                JSON.parse(
                    await readFile(
                        `training/defects/${directory}/defect.json`,
                        'utf8',
                    ),
                ) as Defect,
        ),
    );

    const list = (): void => {
        for (const defect of defects) {
            process.stdout.write(
                `${defect.id}\t${defect.detectingLayer}\t${defect.concept}\n`,
            );
        }
    };

    const verify = async (): Promise<void> => {
        const base = (
            await exec('git', ['rev-parse', 'HEAD'], { cwd: repo })
        ).stdout.trim();
        for (const defect of defects) {
            const worktree = await mkdtemp(join(tmpdir(), `${defect.id}-`));
            let output = '';
            try {
                await exec(
                    'git',
                    ['worktree', 'add', '--detach', worktree, base],
                    { cwd: repo },
                );
                await symlink(
                    join(repo, 'node_modules'),
                    join(worktree, 'node_modules'),
                    'dir',
                );
                const patchPath = join(
                    repo,
                    'training/defects',
                    defect.id.replace('c05-', ''),
                    defect.patch,
                );
                await exec('git', ['apply', '--check', patchPath], {
                    cwd: worktree,
                });
                await exec('git', ['apply', patchPath], { cwd: worktree });
                const command = defect.expectedCommand[0];
                const args = defect.expectedCommand.slice(1);
                let commandPassed = false;
                try {
                    const result = await exec(command, args, {
                        cwd: worktree,
                        env: { ...process.env, CI: 'true' },
                    });
                    output = `${result.stdout}\n${result.stderr}`;
                    commandPassed = true;
                } catch (error) {
                    const failure = error as {
                        stdout?: string;
                        stderr?: string;
                    };
                    output = `${failure.stdout ?? ''}\n${failure.stderr ?? ''}`;
                }
                if (commandPassed)
                    throw new Error(`${defect.id} command unexpectedly passed`);
                if (
                    !output.includes('FAIL') &&
                    !output.includes('failed') &&
                    defect.id !== 'c05-visual-layout' &&
                    defect.id !== 'c05-e2e-integration'
                ) {
                    throw new Error(
                        `${defect.id} did not expose a named failing test`,
                    );
                }
                process.stdout.write(
                    `verified ${defect.id}: expected ${defect.detectingLayer} failure\n`,
                );
            } finally {
                await exec('git', ['worktree', 'remove', '--force', worktree], {
                    cwd: repo,
                }).catch(() => undefined);
            }
        }
        await writeFile(
            'artifacts/defects-verified.txt',
            `${defects.map((defect) => defect.id).join('\n')}\n`,
        );
    };

    if (process.argv[2] === 'verify') await verify();
    else list();
};

void main().catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
});
