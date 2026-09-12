import type { ServerType } from '@hono/node-server';
import { createAdaptorServer } from '@hono/node-server';
import type { OpenAPIHono } from '@hono/zod-openapi';
import app, { type AppEnv } from './app';

export const createServer = (
    port = 0,
    appInstance: OpenAPIHono<AppEnv> = app,
): ServerType => createAdaptorServer({ fetch: appInstance.fetch, port });
