import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../app';
import { createLogger, type StructuredLoggerOptions } from './logger';
import { normalizeRoute } from './redaction';

const correlationIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

export const isValidCorrelationId = (
    value: string | undefined,
): value is string => Boolean(value && correlationIdPattern.test(value));

export const effectiveCorrelationId = (
    candidate: string | undefined,
): string =>
    isValidCorrelationId(candidate) ? candidate : crypto.randomUUID();

export const correlationMiddleware = (
    mode: StructuredLoggerOptions['mode'] = 'development',
): MiddlewareHandler<AppEnv> => {
    const logger = createLogger(mode);
    return async (c, next) => {
        const correlationId = effectiveCorrelationId(
            c.req.header('X-Correlation-Id'),
        );
        c.set('correlationId', correlationId);
        c.header('X-Correlation-Id', correlationId);
        const startedAt = performance.now();
        logger.info({
            event: 'http.request.start',
            method: c.req.method,
            route: normalizeRoute(new URL(c.req.url).pathname),
            correlationId,
            traceId: c.get('traceId'),
            spanId: c.get('spanId'),
        });
        try {
            await next();
        } catch (error) {
            logger.error({
                event: 'http.request.error',
                method: c.req.method,
                route: normalizeRoute(new URL(c.req.url).pathname),
                correlationId,
                error: error instanceof Error ? error.name : 'unknown',
                traceId: c.get('traceId'),
                spanId: c.get('spanId'),
            });
            throw error;
        } finally {
            logger.info({
                event: 'http.request.end',
                method: c.req.method,
                route: normalizeRoute(
                    c.req.routePath || new URL(c.req.url).pathname,
                ),
                status: c.res.status,
                durationMs:
                    Math.round((performance.now() - startedAt) * 100) / 100,
                correlationId,
                traceId: c.get('traceId'),
                spanId: c.get('spanId'),
            });
        }
    };
};
