export default {
    '*.{ts,tsx,js,jsx,mjs,json,md,yml,yaml}': ['biome check --write'],
    '**/*.test.{ts,tsx}': ['vitest related --run'],
};
