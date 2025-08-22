import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    clearMocks: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageProvider: 'v8',
    coverageReporters: ['text', 'lcov', 'clover', 'html'],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
        },
    },
    testMatch: ['**/__tests__/**/*.test.(ts|js)', '**/?(*.)+(spec|test).(ts|js)'],
    transformIgnorePatterns: ['/node_modules/'],
    reporters: [
        'default',
        [
            './node_modules/@testomatio/reporter/lib/adapter/jest.js',
            {
                apiKey: process.env.TESTOMATIO,
            },
        ],
    ],
};

export default config;
