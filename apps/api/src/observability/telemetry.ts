import {
    context,
    propagation,
    type Span,
    type SpanOptions,
    SpanStatusCode,
    trace,
} from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
    defaultResource,
    resourceFromAttributes,
} from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
    BasicTracerProvider,
    InMemorySpanExporter,
    SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../app';
import { normalizeRoute } from './redaction';

const SERVICE_NAME = 'jubilant-adventure-api';

export type TelemetryMode = 'disabled' | 'memory' | 'otlp';

export interface InMemoryTelemetry {
    exporter: InMemorySpanExporter;
    provider: BasicTracerProvider;
    shutdown: () => Promise<void>;
}

export const telemetryMode = (): TelemetryMode => {
    const configured = process.env.OTEL_MODE;
    if (
        configured === 'disabled' ||
        configured === 'memory' ||
        configured === 'otlp'
    ) {
        return configured;
    }
    return 'disabled';
};

export const createInMemoryTelemetry = (): InMemoryTelemetry => {
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({
        resource: defaultResource().merge(
            resourceFromAttributes({ 'service.name': SERVICE_NAME }),
        ),
        spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    return { exporter, provider, shutdown: () => provider.shutdown() };
};

export const startTelemetry = (
    mode = telemetryMode(),
): NodeSDK | InMemoryTelemetry | undefined => {
    if (mode === 'disabled') return undefined;
    if (mode === 'memory') {
        const inMemory = createInMemoryTelemetry();
        context.setGlobalContextManager(
            new AsyncLocalStorageContextManager().enable(),
        );
        trace.setGlobalTracerProvider(inMemory.provider);
        return inMemory;
    }
    const endpoint =
        process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
        'http://127.0.0.1:4318/v1/traces';
    const sdk = new NodeSDK({
        resource: defaultResource().merge(
            resourceFromAttributes({ 'service.name': SERVICE_NAME }),
        ),
        traceExporter: new OTLPTraceExporter({ url: endpoint }),
        instrumentations: [
            getNodeAutoInstrumentations({
                '@opentelemetry/instrumentation-http': {
                    ignoreIncomingRequestHook: (request) =>
                        request.url?.startsWith('/health') === true ||
                        request.url?.startsWith('/metrics') === true,
                },
                '@opentelemetry/instrumentation-pg': {
                    enhancedDatabaseReporting: false,
                },
            }),
        ],
    });
    sdk.start();
    return sdk;
};

export const traceMiddleware =
    (): MiddlewareHandler<AppEnv> => async (c, next) => {
        const parent = propagation.extract(context.active(), {
            traceparent: c.req.header('traceparent') ?? '',
            tracestate: c.req.header('tracestate') ?? '',
        });
        const span = trace.getTracer(SERVICE_NAME).startSpan(
            `${c.req.method} ${normalizeRoute(new URL(c.req.url).pathname)}`,
            {
                kind: 1,
                attributes: { 'http.request.method': c.req.method },
            },
            parent,
        );
        const spanContext = span.spanContext();
        if (trace.isSpanContextValid(spanContext)) {
            c.set('traceId', spanContext.traceId);
            c.set('spanId', spanContext.spanId);
        }
        if (
            c.get('appMode') !== 'production' &&
            c.req.header('x-diagnostic-trace') !== undefined
        ) {
            if (trace.isSpanContextValid(spanContext)) {
                c.header('X-Trace-Id', spanContext.traceId);
            }
        }
        return context.with(trace.setSpan(context.active(), span), async () => {
            try {
                await next();
                span.setAttribute('http.response.status_code', c.res.status);
                span.setStatus({
                    code:
                        c.res.status >= 500
                            ? SpanStatusCode.ERROR
                            : SpanStatusCode.UNSET,
                });
            } catch (error) {
                span.recordException(
                    error instanceof Error ? error : new Error('unknown error'),
                );
                span.setStatus({ code: SpanStatusCode.ERROR });
                throw error;
            } finally {
                span.end();
            }
        });
    };

export const withSpan = async <T>(
    name: string,
    operation: (span: Span) => Promise<T> | T,
    options?: SpanOptions,
): Promise<T> => {
    const span = trace.getTracer(SERVICE_NAME).startSpan(name, options);
    return context.with(trace.setSpan(context.active(), span), async () => {
        try {
            return await operation(span);
        } catch (error) {
            span.recordException(
                error instanceof Error ? error : new Error('unknown error'),
            );
            span.setStatus({ code: SpanStatusCode.ERROR });
            throw error;
        } finally {
            span.end();
        }
    });
};

export const injectTraceHeaders = (headers: Headers): void => {
    propagation.inject(context.active(), headers, {
        set(carrier, key, value) {
            carrier.set(key, value);
        },
    });
};

export const currentTraceContext = (): {
    traceId?: string;
    spanId?: string;
} => {
    const spanContext = trace.getSpan(context.active())?.spanContext();
    return spanContext && trace.isSpanContextValid(spanContext)
        ? { traceId: spanContext.traceId, spanId: spanContext.spanId }
        : {};
};

propagation.setGlobalPropagator(new W3CTraceContextPropagator());
