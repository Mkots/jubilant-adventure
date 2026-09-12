import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => {
    server.listen({
        onUnhandledRequest: ({ method, url }) => {
            throw new Error(`Unhandled ${method} request to ${url}`);
        },
    });
});

afterEach(() => {
    server.resetHandlers();
    cleanup();
    vi.useRealTimers();
});

afterAll(() => {
    server.close();
});
