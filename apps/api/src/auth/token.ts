import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Actor } from '@jubilant-adventure/shop-domain';

interface TokenPayload {
    sub: string;
    role: Actor['role'];
    exp: number;
}

const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
).toString('base64url');

const sign = (value: string, secret: string): string =>
    createHmac('sha256', secret).update(value).digest('base64url');

export const createAccessToken = (
    actor: Actor,
    secret: string,
    now: Date,
    ttlSeconds = 900,
): string => {
    const payload: TokenPayload = {
        sub: actor.userId,
        role: actor.role,
        exp: Math.floor(now.getTime() / 1000) + ttlSeconds,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
        'base64url',
    );
    const unsigned = `${header}.${encodedPayload}`;
    return `${unsigned}.${sign(unsigned, secret)}`;
};

export const verifyAccessToken = (
    token: string,
    secret: string,
    now: Date,
): Actor | undefined => {
    const parts = token.split('.');
    if (parts.length !== 3) return undefined;
    const [tokenHeader, encodedPayload, signature] = parts;
    const expectedSignature = sign(`${tokenHeader}.${encodedPayload}`, secret);
    const actual = Buffer.from(signature, 'base64url');
    const expected = Buffer.from(expectedSignature, 'base64url');
    if (
        actual.length !== expected.length ||
        !timingSafeEqual(actual, expected)
    ) {
        return undefined;
    }
    try {
        if (tokenHeader !== header) return undefined;
        const payload = JSON.parse(
            Buffer.from(encodedPayload, 'base64url').toString('utf8'),
        ) as TokenPayload;
        if (
            typeof payload.sub !== 'string' ||
            (payload.role !== 'user' && payload.role !== 'admin') ||
            !Number.isInteger(payload.exp) ||
            payload.exp <= Math.floor(now.getTime() / 1000)
        ) {
            return undefined;
        }
        return { userId: payload.sub, role: payload.role };
    } catch {
        return undefined;
    }
};
