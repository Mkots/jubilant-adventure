import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/pact/consumer.test.ts'],
        testTimeout: 30_000,
    },
});
