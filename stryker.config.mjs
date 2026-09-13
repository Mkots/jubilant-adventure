export default {
    testRunner: 'vitest',
    plugins: ['@stryker-mutator/vitest-runner'],
    mutate: [
        'packages/exercises/src/utils/isEven.ts',
        'packages/exercises/src/utils/range.ts',
        'packages/exercises/src/utils/triangle.ts',
        'packages/shop-domain/src/services.ts',
    ],
    vitest: {
        configFile: 'tests/mutation/vitest.config.mts',
        related: true,
    },
    reporters: ['clear-text', 'progress', 'json', 'html'],
    jsonReporter: { fileName: 'artifacts/mutation/mutation.json' },
    htmlReporter: { fileName: 'artifacts/mutation/mutation.html' },
    tempDirName: '.stryker-tmp',
    timeoutMS: 10000,
    timeoutFactor: 1.5,
    concurrency: 2,
    thresholds: {
        high: 80,
        low: 70,
        break: 70,
    },
    disableTypeChecks: true,
    inPlace: true,
};
