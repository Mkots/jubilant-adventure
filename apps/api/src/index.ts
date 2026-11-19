import { telemetrySdk } from './observability/bootstrap';

const mode =
    process.env.APP_MODE === 'test' || process.env.APP_MODE === 'production'
        ? process.env.APP_MODE
        : 'development';

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

const start = async (): Promise<void> => {
    const { serve } = await import('@hono/node-server');
    const { createApp, createPostgresApp } = await import('./app');
    const { parseProcessingDelay } = await import('./accounts/jobs');
    const accountProcessingDelay = parseProcessingDelay(
        process.env.ACCOUNT_PROCESSING_DELAY_MS,
    );
    const app =
        process.env.APP_PERSISTENCE === 'postgres'
            ? await createPostgresApp({
                  mode,
                  testControlKey: process.env.TEST_CONTROL_KEY,
                  tokenSecret: process.env.API_TOKEN_SECRET,
                  databaseUrl: process.env.DATABASE_URL,
                  accountProcessingDelay,
              })
            : createApp({
                  mode,
                  testControlKey: process.env.TEST_CONTROL_KEY,
                  tokenSecret: process.env.API_TOKEN_SECRET,
                  accountProcessingDelay,
              });
    const server = serve(
        { fetch: app.fetch, port: configuredPort },
        ({ port }) => {
            // biome-ignore lint/suspicious/noConsole: log server start
            console.log(`API server is listening on http://localhost:${port}`);
        },
    );
    const shutdown = async (): Promise<void> => {
        if ('close' in app && typeof app.close === 'function') {
            await app.close();
        }
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
        await telemetrySdk?.shutdown();
    };
    process.once('SIGTERM', () => void shutdown());
    process.once('SIGINT', () => void shutdown());
};

void start().catch((error: unknown) => {
    // biome-ignore lint/suspicious/noConsole: surface startup failures
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
