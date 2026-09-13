import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: [
            'packages/exercises/__tests__/**/*.test.ts',
            'packages/shop-domain/__tests__/**/*.test.ts',
        ],
    },
});
