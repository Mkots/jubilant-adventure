export default {
    '*.{ts,tsx,js,jsx,mjs,json,md,yml,yaml}': [
        'biome check --write --files-ignore-unknown=true --no-errors-on-unmatched',
    ],
    '**/*.test.{ts,tsx}': ['vitest related --run'],
};
