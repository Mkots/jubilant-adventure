import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/wiremock/**/*.test.ts'],
        testTimeout: 10_000,
    },
});
