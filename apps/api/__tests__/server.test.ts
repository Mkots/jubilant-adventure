import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createServer } from '../src/server';

const request = (port: number, path: string) =>
    new Promise<{ statusCode: number | undefined; body: unknown }>(
        (resolve, reject) => {
            const http = httpRequest(
                { hostname: '127.0.0.1', port, path },
                (response) => {
                    let body = '';
                    response.setEncoding('utf8');
                    response.on('data', (chunk) => {
                        body += chunk;
                    });
                    response.on('end', () => {
                        resolve({
                            statusCode: response.statusCode,
                            body: JSON.parse(body),
                        });
                    });
                },
            );
            http.on('error', reject);
            http.end();
        },
    );

describe('HTTP server', () => {
    let server: ReturnType<typeof createServer>;
    let port: number;

    beforeEach(
        () =>
            new Promise<void>((resolve) => {
                server = createServer();
                server.listen(0, () => {
                    port = (server.address() as AddressInfo).port;
                    resolve();
                });
            }),
    );

    afterEach(
        () =>
            new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
            }),
    );

    test('routes requests and parses query strings', async () => {
        const response = await request(port, '/sample/hello?name=Codex');

        expect(response.statusCode).toBe(406);
        expect(response.body).toEqual({ message: 'Hello' });
    });

    test('returns the request data for the sample route', async () => {
        const response = await request(port, '/sample');

        expect(response.statusCode).toBe(406);
        expect(response.body).toMatchObject({
            trimmedPath: 'sample',
            method: 'GET',
            queryStringObject: {},
            payload: '',
        });
    });

    test('returns 404 for an unknown route', async () => {
        const response = await request(port, '/missing');

        expect(response.statusCode).toBe(404);
        expect(response.body).toEqual({ message: 'Not found' });
    });
});
