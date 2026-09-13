import {
    mkdir,
    mkdtemp,
    readdir,
    readFile,
    rm,
    writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    sanitizeAllureResults,
    sanitizeApiExchange,
    sanitizeHeaders,
    sanitizeText,
    sanitizeUrl,
    sanitizeValue,
} from '../../scripts/allure/sanitizer';
import {
    assertSafeSegment,
    resolveWithin,
} from '../../scripts/lib/safe-path.mjs';

describe('Allure attachment sanitizer', () => {
    it('rejects traversal and shell-like path segments', () => {
        expect(() => resolveWithin(process.cwd(), '../outside')).toThrow(
            /inside/,
        );
        expect(() => resolveWithin(process.cwd(), 'artifacts/../..')).toThrow(
            /inside/,
        );
        expect(() => assertSafeSegment('report; touch /tmp/pwned')).toThrow(
            /unsafe/,
        );
    });

    it('redacts credentials in text, URLs, headers, and nested values', () => {
        expect(
            sanitizeText('Authorization: Bearer dummy-access-token'),
        ).not.toContain('dummy-access-token');
        expect(
            sanitizeUrl(
                'https://shop.test/orders?token=canary-token&status=paid',
            ),
        ).not.toContain('canary-token');
        expect(
            sanitizeHeaders({
                Authorization: 'Bearer canary-token',
                status: '201',
            }).Authorization,
        ).toBe('[REDACTED]');
        expect(
            sanitizeValue({
                request: { password: 'canary-password' },
                status: 201,
            }),
        ).toEqual({ request: { password: '[REDACTED]' }, status: 201 });
    });

    it('keeps reproducible route and status evidence in exchanges', () => {
        const exchange = sanitizeApiExchange({
            request: {
                method: 'POST',
                url: 'https://shop.test/orders?token=canary-token',
                headers: { Authorization: 'Bearer canary-token' },
                body: { password: 'canary-password', quantity: 1 },
            },
            response: {
                status: 409,
                headers: { 'content-type': 'application/json' },
                body: { code: 'insufficient_stock' },
            },
        });
        expect(exchange.request.method).toBe('POST');
        expect(exchange.request.url).toContain('/orders');
        expect(exchange.response.status).toBe(409);
        expect(JSON.stringify(exchange)).not.toMatch(/canary-|dummy-/);
    });

    it('sanitizes result JSON and text attachments before publication', async () => {
        const testRoot = await mkdtemp(
            join(process.cwd(), 'artifacts', '.allure-test-'),
        );
        const input = join(testRoot, 'input');
        const output = join(testRoot, 'output');
        await mkdir(input);
        await mkdir(output);
        await writeFile(
            join(input, 'case-result.json'),
            JSON.stringify({
                name: 'leak canary',
                status: 'failed',
                attachments: [
                    {
                        name: 'exchange.json',
                        source: 'exchange.txt',
                        type: 'text/plain',
                    },
                ],
                parameters: [{ name: 'token', value: 'canary-token' }],
            }),
        );
        await writeFile(
            join(input, 'exchange.txt'),
            'route=/orders Authorization: Bearer canary-token password=canary-password',
        );
        await sanitizeAllureResults(input, output);
        const files = await readdir(output);
        const contents = await Promise.all(
            files.map((file) => readFile(join(output, file), 'utf8')),
        );
        expect(contents.join('\n')).not.toMatch(/canary-|dummy-/);
        expect(contents.join('\n')).toContain('failed');
        await rm(testRoot, { recursive: true, force: true });
    });
});
