import { createHmac } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { createAccessToken, verifyAccessToken } from '../src/auth/token';

const now = new Date('2026-01-01T00:00:00.000Z');
const secret = 'test-secret';

const signPayload = (header: string, payload: string): string => {
    const unsigned = `${header}.${payload}`;
    const signature = createHmac('sha256', secret)
        .update(unsigned)
        .digest('base64url');
    return `${unsigned}.${signature}`;
};

describe('access tokens', () => {
    test('round trips user and admin actors', () => {
        const userToken = createAccessToken(
            { userId: 'user-1', role: 'user' },
            secret,
            now,
        );
        const adminToken = createAccessToken(
            { userId: 'admin-1', role: 'admin' },
            secret,
            now,
        );

        expect(verifyAccessToken(userToken, secret, now)).toEqual({
            userId: 'user-1',
            role: 'user',
        });
        expect(verifyAccessToken(adminToken, secret, now)).toEqual({
            userId: 'admin-1',
            role: 'admin',
        });
    });

    test('rejects malformed and tampered tokens', () => {
        const token = createAccessToken(
            { userId: 'user-1', role: 'user' },
            secret,
            now,
        );
        const [tokenHeader, payload, signature] = token.split('.');

        expect(verifyAccessToken('not-a-token', secret, now)).toBeUndefined();
        expect(
            verifyAccessToken(
                `${tokenHeader}.${payload}.${'a'.repeat(signature.length)}`,
                secret,
                now,
            ),
        ).toBeUndefined();
        expect(
            verifyAccessToken(
                `${tokenHeader}.${payload}.${signature}`,
                'wrong-secret',
                now,
            ),
        ).toBeUndefined();
    });

    test('rejects invalid headers, payloads, and expiry', () => {
        const token = createAccessToken(
            { userId: 'user-1', role: 'user' },
            secret,
            now,
        );
        const [, payload] = token.split('.');
        const alternateHeader = Buffer.from(
            JSON.stringify({ alg: 'HS384', typ: 'JWT' }),
        ).toString('base64url');
        expect(
            verifyAccessToken(
                signPayload(alternateHeader, payload),
                secret,
                now,
            ),
        ).toBeUndefined();

        const expired = createAccessToken(
            { userId: 'user-1', role: 'user' },
            secret,
            now,
            -1,
        );
        expect(verifyAccessToken(expired, secret, now)).toBeUndefined();

        const header = token.split('.')[0];
        expect(
            verifyAccessToken(
                signPayload(
                    header,
                    Buffer.from(
                        JSON.stringify({ sub: 1, role: 'user', exp: 1 }),
                    ).toString('base64url'),
                ),
                secret,
                now,
            ),
        ).toBeUndefined();
        expect(
            verifyAccessToken(
                signPayload(
                    header,
                    Buffer.from('not-json').toString('base64url'),
                ),
                secret,
                now,
            ),
        ).toBeUndefined();
    });
});
