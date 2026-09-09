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
                    statements: 80,
                    branches: 80,
                    functions: 80,
                    lines: 80,
                },
            },
            exclude: ['src/index.ts', 'src/routes/routerTypes.ts'],
        },
        include: [
            '**/__tests__/**/*.test.(ts|js)',
            '**/?(*.)+(spec|test).(ts|js)',
        ],
    },
});
