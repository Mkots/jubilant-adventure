import type { AddressInfo } from 'node:net';
import type { ServerType } from '@hono/node-server';
import { createApp } from '../../apps/api/src/app';
import { createServer } from '../../apps/api/src/server';

export interface RunningApi {
    baseUrl: string;
    close: () => Promise<void>;
}

export const startTestApi = async (): Promise<RunningApi> => {
    const app = createApp({
        mode: 'test',
        testControlKey: 'black-box-control',
        tokenSecret: 'black-box-secret',
    });
    const server: ServerType = createServer(0, app);
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, resolve);
    });
    const port = (server.address() as AddressInfo).port;
    return {
        baseUrl: `http://127.0.0.1:${port}`,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
            }),
    };
};
