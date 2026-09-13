import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../..',
);
const systemPath =
    process.platform === 'win32'
        ? ['C:\\Windows\\System32', 'C:\\Windows']
        : [
              '/usr/local/sbin',
              '/usr/local/bin',
              '/usr/sbin',
              '/usr/bin',
              '/sbin',
              '/bin',
          ];

export const safePath = (root = repositoryRoot) =>
    [...systemPath, resolve(root, 'node_modules/.bin')].join(delimiter);
