import { readFile } from 'node:fs/promises';

const file = new URL('../../sonar-project.properties', import.meta.url);
const source = await readFile(file, 'utf8');
const required = [
    'sonar.projectKey=',
    'sonar.sources=',
    'sonar.tests=',
    'sonar.javascript.lcov.reportPaths=',
    'sonar.exclusions=',
];
const missing = required.filter((entry) => !source.includes(entry));
if (missing.length > 0)
    throw new Error(`Missing Sonar settings: ${missing.join(', ')}`);
if (source.includes('SONAR_TOKEN=') || source.includes('sonar.login=')) {
    throw new Error(
        'Sonar credentials must be provided through the environment',
    );
}
process.stdout.write('SonarQube configuration is valid and credential-free\n');
