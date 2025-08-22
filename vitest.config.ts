import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'clover', 'html'],
            thresholds: {
                global: {
                    branches: 80,
                    functions: 80,
                    lines: 80,
                    statements: 80,
                },
            },
        },
        include: ['**/__tests__/**/*.test.(ts|js)', '**/?(*.)+(spec|test).(ts|js)'],
    },
});
