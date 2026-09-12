import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import app from '../src/app';
import { createServer } from '../src/server';

describe('Hono application', () => {
    test('routes requests and parses query strings in process', async () => {
        const response = await app.request('/sample/hello?name=Codex');

        expect(response.status).toBe(406);
        expect(await response.json()).toEqual({ message: 'Hello' });
    });

    test('returns the request data for the sample route', async () => {
        const response = await app.request('/sample');

        expect(response.status).toBe(406);
        expect(await response.json()).toEqual({
            trimmedPath: 'sample',
            method: 'GET',
            queryStringObject: {},
            payload: '',
        });
    });

    test('returns JSON 404 for an unknown route', async () => {
        const response = await app.request('/missing');

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ message: 'Not found' });
    });
});

describe('Node adapter', () => {
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

    test('starts on an ephemeral port and serves the app', async () => {
        const response = await fetch(`http://127.0.0.1:${port}/sample`);

        expect(response.status).toBe(406);
        expect(await response.json()).toMatchObject({
            trimmedPath: 'sample',
            method: 'GET',
        });
    });
});
