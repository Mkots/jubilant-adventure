export default {
    '*.{ts,tsx,js,jsx,mjs,json,md,yml,yaml}': [
        'biome check --write --files-ignore-unknown=true --no-errors-on-unmatched',
    ],
    '**/*.test.{ts,tsx}': [
        'vitest related --run --exclude apps/web/src/testing/mock-lab/**',
    ],
    'apps/web/src/testing/mock-lab/**/*.test.{ts,tsx}': [
        'npm run test:mock-lab --workspace apps/web',
    ],
};
