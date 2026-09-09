import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'clover', 'html'],
            exclude: ['node_modules/**', 'playwright/**'],
            thresholds: {
                global: {
                    statements: 80,
                    branches: 80,
                    functions: 80,
                    lines: 80,
                },
            },
        },
        include: [
            '**/__tests__/**/*.test.(ts|js)',
            '**/?(*.)+(spec|test).(ts|js)',
        ],
        exclude: ['node_modules/**', 'playwright/**'],
    },
});
