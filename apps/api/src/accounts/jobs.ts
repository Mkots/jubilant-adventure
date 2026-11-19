import type { BackgroundJobs } from '@jubilant-adventure/shop-domain';

export interface ProcessingDelay {
    minMs: number;
    maxMs: number;
}

/**
 * Simulated backend processing time for verification and bonus activation.
 * The jitter is deliberate: clients must poll for the final state instead of
 * sleeping for a fixed time.
 */
export const defaultProcessingDelay: ProcessingDelay = {
    minMs: 500,
    maxMs: 2500,
};

/** Parses `ACCOUNT_PROCESSING_DELAY_MS`, accepting `1500` or `500-2500`. */
export const parseProcessingDelay = (
    value: string | undefined,
): ProcessingDelay => {
    if (value === undefined || value.trim() === '') {
        return defaultProcessingDelay;
    }
    const match = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(value);
    const min = Number(match?.[1]);
    const max = Number(match?.[2] ?? match?.[1]);
    if (!match || !Number.isSafeInteger(min) || max < min) {
        throw new Error(
            `ACCOUNT_PROCESSING_DELAY_MS must be "<ms>" or "<min>-<max>"; received ${value}`,
        );
    }
    return { minMs: min, maxMs: max };
};

export const delaySampler =
    ({ minMs, maxMs }: ProcessingDelay) =>
    (): number =>
        minMs + Math.floor(Math.random() * (maxMs - minMs + 1));

/** Runs jobs on timers that never keep the process alive on shutdown. */
export const createTimerJobs = (
    onError: (error: unknown) => void,
): BackgroundJobs => ({
    schedule: (job, delayMs) => {
        const timer = setTimeout(() => {
            job().catch(onError);
        }, delayMs);
        timer.unref();
    },
});
