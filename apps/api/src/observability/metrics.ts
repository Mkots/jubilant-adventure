import type { MiddlewareHandler } from 'hono';
import { Counter, Histogram, Registry } from 'prom-client';
import type { AppEnv } from '../app';
import { normalizeRoute } from './redaction';

export interface ApiMetrics {
    registry: Registry;
    requests: Counter<'method' | 'route' | 'status_class'>;
    errors: Counter<'method' | 'route' | 'status_class'>;
    duration: Histogram<'method' | 'route' | 'status_class'>;
}

export const createApiMetrics = (): ApiMetrics => {
    const registry = new Registry();
    const labels = ['method', 'route', 'status_class'] as const;
    const requests = new Counter({
        name: 'http_requests_total',
        help: 'Total HTTP requests handled by the API',
        labelNames: labels,
        registers: [registry],
    });
    const errors = new Counter({
        name: 'http_request_errors_total',
        help: 'Total HTTP requests returning a 4xx or 5xx status',
        labelNames: labels,
        registers: [registry],
    });
    const duration = new Histogram({
        name: 'http_request_duration_seconds',
        help: 'HTTP request duration in seconds',
        labelNames: labels,
        buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
        registers: [registry],
    });
    return { registry, requests, errors, duration };
};

export const metricsMiddleware =
    (metrics: ApiMetrics): MiddlewareHandler<AppEnv> =>
    async (c, next) => {
        if (new URL(c.req.url).pathname === '/metrics') {
            await next();
            return;
        }
        const startedAt = performance.now();
        try {
            await next();
        } finally {
            const status = c.res.status >= 400 ? c.res.status : 500;
            const labels = {
                method: c.req.method,
                route: normalizeRoute(
                    c.req.routePath || new URL(c.req.url).pathname,
                ),
                status_class: `${Math.floor(status / 100)}xx`,
            } as const;
            metrics.requests.inc(labels);
            if (status >= 400) metrics.errors.inc(labels);
            metrics.duration.observe(
                labels,
                (performance.now() - startedAt) / 1000,
            );
        }
    };
