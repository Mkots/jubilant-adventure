import { serve } from '@hono/node-server';
import { createApp } from './app';

const mode =
    process.env.APP_MODE === 'test' || process.env.APP_MODE === 'production'
        ? process.env.APP_MODE
        : 'development';

const app = createApp({
    mode,
    testControlKey: process.env.TEST_CONTROL_KEY,
    tokenSecret: process.env.API_TOKEN_SECRET,
});

const configuredPort = Number.parseInt(process.env.PORT ?? '3000', 10);

if (
    !Number.isInteger(configuredPort) ||
    configuredPort < 0 ||
    configuredPort > 65535
) {
    throw new Error(
        `PORT must be an integer between 0 and 65535; received ${process.env.PORT}`,
    );
}

serve({ fetch: app.fetch, port: configuredPort }, ({ port }) => {
    // biome-ignore lint/suspicious/noConsole: log server start
    console.log(`API server is listening on http://localhost:${port}`);
});
