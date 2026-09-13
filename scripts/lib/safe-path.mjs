import { isAbsolute, relative, resolve, sep } from 'node:path';

const isOutside = (candidate) =>
    candidate === '..' ||
    candidate.startsWith(`..${sep}`) ||
    isAbsolute(candidate);

export const resolveWithin = (baseDirectory, candidate, label = 'path') => {
    if (typeof candidate !== 'string' || candidate.length === 0) {
        throw new Error(`${label} must be a non-empty string`);
    }
    const base = resolve(baseDirectory);
    const resolved = resolve(base, candidate);
    if (isOutside(relative(base, resolved))) {
        throw new Error(`${label} must stay inside ${base}`);
    }
    return resolved;
};

export const assertSafeSegment = (value, label = 'value') => {
    if (
        typeof value !== 'string' ||
        value.length === 0 ||
        value === '.' ||
        value === '..' ||
        !/^[A-Za-z0-9._-]+$/.test(value)
    ) {
        throw new Error(`${label} contains unsafe path characters`);
    }
    return value;
};
