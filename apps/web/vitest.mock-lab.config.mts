import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['src/testing/mock-lab/**/*.test.ts'],
        clearMocks: true,
        restoreMocks: true,
    },
});
