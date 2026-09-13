import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        hookTimeout: 120_000,
        include: ['tests/resilience/**/*.test.ts'],
        testTimeout: 120_000,
    },
});
