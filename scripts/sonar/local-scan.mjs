import { spawn } from 'node:child_process';

const scannerImage = 'sonarsource/sonar-scanner-cli:11.0.1.1913_6.1.0';
const child = spawn(
    'docker',
    [
        'run',
        '--rm',
        '--network=host',
        '-e',
        'SONAR_HOST_URL=http://127.0.0.1:9000',
        '-e',
        'SONAR_TOKEN',
        '-v',
        `${process.cwd()}:/usr/src`,
        scannerImage,
    ],
    { stdio: 'inherit' },
);
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
