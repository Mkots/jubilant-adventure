import { serve } from '@hono/node-server';
import app from './app';

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
