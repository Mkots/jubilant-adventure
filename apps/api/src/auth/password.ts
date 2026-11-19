import {
    randomBytes,
    type ScryptOptions,
    scrypt,
    scryptSync,
    timingSafeEqual,
} from 'node:crypto';
import type {
    PasswordHasher,
    PasswordVerifier,
} from '@jubilant-adventure/shop-domain';
import { fixturePasswordVerifier } from '@jubilant-adventure/test-data';

const prefix = 'scrypt';
const keyLength = 32;
const options: ScryptOptions = { N: 16384, r: 8, p: 1 };

const derive = (password: string, salt: Buffer): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        scrypt(password, salt, keyLength, options, (error, key) =>
            error ? reject(error) : resolve(key),
        );
    });

/** Hashes passwords of users registered through the API. */
export const scryptPasswordHasher: PasswordHasher = {
    hash: async (password) => {
        const salt = randomBytes(16);
        const key = await derive(password, salt);
        return `${prefix}$${salt.toString('base64url')}$${key.toString('base64url')}`;
    },
};

const verifyScrypt = (password: string, passwordHash: string): boolean => {
    const [, salt, expected] = passwordHash.split('$');
    if (!salt || !expected) return false;
    const expectedKey = Buffer.from(expected, 'base64url');
    const actualKey = scryptSync(
        password,
        Buffer.from(salt, 'base64url'),
        keyLength,
        options,
    );
    return (
        actualKey.length === expectedKey.length &&
        timingSafeEqual(actualKey, expectedKey)
    );
};

/** Accepts scrypt hashes of registered users and the fixture users' hashes. */
export const passwordVerifier: PasswordVerifier = {
    verify: (password, passwordHash) =>
        passwordHash.startsWith(`${prefix}$`)
            ? verifyScrypt(password, passwordHash)
            : fixturePasswordVerifier.verify(password, passwordHash),
};
