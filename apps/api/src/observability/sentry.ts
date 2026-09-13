import type { Event } from '@sentry/node';
import * as Sentry from '@sentry/node';
import { redactSensitive } from './redaction';

export interface ErrorTrackingContext {
    correlationId?: string;
    traceId?: string;
    spanId?: string;
}

const scrubText = (value: string): string =>
    value
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
        .replace(/(?:canary|dummy)-[A-Za-z0-9_-]+/gi, '[redacted]');

const scrubEventText = (value: unknown): unknown => {
    if (typeof value === 'string') return scrubText(value);
    if (Array.isArray(value)) return value.map(scrubEventText);
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, child]) => [
                key,
                scrubEventText(child),
            ]),
        );
    }
    return value;
};

export const sanitizeSentryEvent = (event: Event): Event => {
    const sanitized = scrubEventText(redactSensitive(event)) as Event &
        Record<string, unknown>;
    delete sanitized.request;
    delete sanitized.user;
    if (Array.isArray(sanitized.breadcrumbs)) {
        sanitized.breadcrumbs = sanitized.breadcrumbs.map((breadcrumb) => ({
            ...(breadcrumb as Record<string, unknown>),
            data: undefined,
        }));
    }
    return sanitized;
};

export const initBackendErrorTracking = (): boolean => {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) return false;
    Sentry.init({
        dsn,
        release: process.env.SENTRY_RELEASE,
        environment: process.env.SENTRY_ENVIRONMENT ?? process.env.APP_MODE,
        maxBreadcrumbs: 10,
        tracesSampleRate: 0,
        beforeSend: (event) =>
            sanitizeSentryEvent(event as Event) as typeof event,
    });
    return true;
};

export const captureBackendException = (
    error: unknown,
    metadata: ErrorTrackingContext,
): void => {
    if (!Sentry.isEnabled()) return;
    Sentry.withScope((scope) => {
        for (const [key, value] of Object.entries(metadata)) {
            if (value) scope.setTag(key, value);
        }
        Sentry.captureException(error);
    });
};
