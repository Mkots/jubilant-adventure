import type { Event } from '@sentry/react';
import * as Sentry from '@sentry/react';

const scrubText = (value: string): string =>
    value
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
        .replace(/(?:canary|dummy)-[A-Za-z0-9_-]+/gi, '[redacted]');

export const initFrontendErrorTracking = (): boolean => {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!dsn) return false;
    Sentry.init({
        dsn,
        release: import.meta.env.VITE_SENTRY_RELEASE,
        environment:
            import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
        maxBreadcrumbs: 10,
        tracesSampleRate: 0,
        beforeSend: (event) => {
            const scrub = JSON.parse(JSON.stringify(event)) as Event &
                Record<string, unknown>;
            const scrubbed = JSON.parse(
                scrubText(JSON.stringify(scrub)),
            ) as Event & Record<string, unknown>;
            delete scrubbed.request;
            delete scrubbed.user;
            if (scrubbed.extra) delete scrubbed.extra.body;
            if (scrubbed.breadcrumbs) {
                scrubbed.breadcrumbs = scrubbed.breadcrumbs.map(
                    (breadcrumb) => ({
                        ...breadcrumb,
                        data: undefined,
                        message: breadcrumb.message?.slice(0, 256),
                    }),
                );
            }
            return scrubbed as typeof event;
        },
    });
    return true;
};

export const captureFrontendException = (
    error: unknown,
    correlationId?: string,
): void => {
    if (!Sentry.isEnabled()) return;
    Sentry.withScope((scope) => {
        if (correlationId) scope.setTag('correlationId', correlationId);
        Sentry.captureException(error);
    });
};
