import { defineConfig } from 'vitest/config';

export default defineConfig({
    define: {
        'import.meta.env.VITE_API_ORIGIN': JSON.stringify(
            'http://api.test/api',
        ),
    },
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/testing/setup.ts'],
        include: ['src/**/*.test.(ts|tsx)'],
        exclude: ['src/testing/mock-lab/**'],
        clearMocks: true,
        restoreMocks: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'html'],
            include: ['src/**/*.{ts,tsx}'],
            exclude: [
                'src/main.tsx',
                'src/vite-env.d.ts',
                'src/styles.css',
                'src/testing/mocks/**',
            ],
        },
    },
});
