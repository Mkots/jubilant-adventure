import type { ServerType } from '@hono/node-server';
import { createAdaptorServer } from '@hono/node-server';
import app from './app';

export const createServer = (port = 0): ServerType =>
    createAdaptorServer({ fetch: app.fetch, port });
