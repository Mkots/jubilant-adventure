import { context, trace } from '@opentelemetry/api';
import type { Event } from '@sentry/node';
import { describe, expect, test, vi } from 'vitest';
import { createApp } from '../src/app';
import {
    effectiveCorrelationId,
    isValidCorrelationId,
} from '../src/observability/correlation';
import { StructuredLogger } from '../src/observability/logger';
import { createApiMetrics } from '../src/observability/metrics';
import { redactSensitive, safeSerialize } from '../src/observability/redaction';
import { sanitizeSentryEvent } from '../src/observability/sentry';
import {
    createInMemoryTelemetry,
    withSpan,
} from '../src/observability/telemetry';

describe('correlation and redaction', () => {
    test('preserves bounded IDs and replaces invalid values', () => {
        expect(isValidCorrelationId('checkout-42')).toBe(true);
        expect(isValidCorrelationId('contains spaces')).toBe(false);
        expect(effectiveCorrelationId('checkout-42')).toBe('checkout-42');
        expect(effectiveCorrelationId('x'.repeat(129))).toMatch(
            /^[0-9a-f-]{36}$/,
        );
    });

    test('redacts secrets without redacting trace identity', () => {
        const serialized = safeSerialize({
            authorization: 'Bearer canary-token',
            password: 'canary-password',
            spanId: 'span-canary',
            nested: { apiKey: 'canary-key' },
        });
        expect(serialized).not.toContain('canary-token');
        expect(serialized).not.toContain('canary-password');
        expect(serialized).not.toContain('canary-key');
        expect(serialized).toContain('span-canary');
        expect(redactSensitive({ body: 'canary-body' })).toEqual({
            body: '[redacted]',
        });
    });

    test('logger emits a searchable JSON event in test mode', () => {
        const sink = vi.fn();
        new StructuredLogger({ mode: 'test', sink }).info({
            event: 'test.event',
            correlationId: 'correlation-canary',
            password: 'secret-canary',
        });
        const line = sink.mock.calls[0]?.[0] as string;
        expect(JSON.parse(line)).toMatchObject({
            event: 'test.event',
            correlationId: 'correlation-canary',
            password: '[redacted]',
        });
        expect(line).not.toContain('secret-canary');
    });

    test('sanitizes Sentry events before they leave the process', () => {
        const event = {
            message: 'payment failed for canary-card',
            request: { url: 'https://example.test', data: 'canary-body' },
            user: { email: 'user@example.test' },
            breadcrumbs: [
                {
                    message: 'Bearer canary-token',
                    data: { token: 'canary-token' },
                },
            ],
            extra: {
                authorization: 'Bearer canary-token',
                safe: 'trace-value',
            },
        } as unknown as Event;
        const sanitized = sanitizeSentryEvent(event);
        const serialized = JSON.stringify(sanitized);
        expect(serialized).not.toContain('canary-token');
        expect(serialized).not.toContain('canary-body');
        expect(serialized).not.toContain('user@example.test');
        expect(serialized).toContain('trace-value');
        expect(sanitized.request).toBeUndefined();
        expect(sanitized.user).toBeUndefined();
    });
});

describe('API observability', () => {
    test('returns the effective correlation ID on success and errors', async () => {
        const app = createApp({ mode: 'test' });
        const valid = await app.request('/health', {
            headers: { 'X-Correlation-Id': 'known-correlation' },
        });
        expect(valid.headers.get('X-Correlation-Id')).toBe('known-correlation');

        const invalid = await app.request('/auth/login', {
            method: 'POST',
            headers: {
                'X-Correlation-Id': 'invalid id',
                'Content-Type': 'application/json',
            },
            body: '{}',
        });
        expect(invalid.status).toBe(400);
        expect(invalid.headers.get('X-Correlation-Id')).toMatch(
            /^[0-9a-f-]{36}$/,
        );
    });

    test('exposes bounded RED metrics and excludes the scrape itself', async () => {
        const app = createApp();
        await app.request('/missing/one');
        await app.request('/missing/two');
        const response = await app.request('/metrics');
        const body = await response.text();
        expect(response.headers.get('content-type')).toContain(
            'text/plain; version=0.0.4',
        );
        expect(body).toContain('http_requests_total');
        expect(body).toContain('route="/*"');
        expect(body).not.toContain('missing/one');
        expect(body).not.toContain('route="/metrics"');
    });

    test('creates an in-memory span with W3C-compatible identity', async () => {
        const telemetry = createInMemoryTelemetry();
        const providerResult = trace.setGlobalTracerProvider(
            telemetry.provider,
        );
        expect(providerResult).toBe(true);
        await withSpan('test.operation', async (span) => {
            span.setAttribute('safe.attribute', 'value');
        });
        await telemetry.provider.forceFlush();
        const spans = telemetry.exporter.getFinishedSpans();
        expect(spans.some((span) => span.name === 'test.operation')).toBe(true);
        expect(spans[0]?.spanContext().traceId).toMatch(/^[0-9a-f]{32}$/);
        await telemetry.shutdown();
        void context;
    });
});

describe('metrics registry', () => {
    test('supports isolated registries for concurrent applications', async () => {
        const first = createApiMetrics();
        const second = createApiMetrics();
        first.requests.inc({
            method: 'GET',
            route: '/health',
            status_class: '2xx',
        });
        expect(
            (await first.registry.metrics()).match(/http_requests_total/g),
        ).not.toBeNull();
        expect(
            (await second.registry.metrics()).match(/method="GET"/g),
        ).toBeNull();
    });
});
