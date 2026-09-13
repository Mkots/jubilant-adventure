import { spawn } from 'node:child_process';
import { safePath } from '../lib/safe-env.mjs';

const releaseArgument = process.argv.find((argument) =>
    argument.startsWith('--release='),
);
const release =
    releaseArgument?.slice('--release='.length) || process.env.SENTRY_RELEASE;
if (!release)
    throw new Error('SENTRY_RELEASE or --release=<value> is required');
for (const name of ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT']) {
    if (!process.env[name])
        throw new Error(`${name} is required for opt-in source-map upload`);
}
const child = spawn(
    'sentry-cli',
    ['sourcemaps', 'upload', 'apps/web/dist', '--release', release],
    {
        stdio: 'inherit',
        shell: false,
        env: {
            ...process.env,
            PATH: safePath(),
            SENTRY_RELEASE: release,
        },
    },
);
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
