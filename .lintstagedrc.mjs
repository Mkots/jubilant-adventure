export default {
    '*.{ts,tsx,js,jsx,json,md,yml,yaml}': ['biome check --write'],
    '**/*.test.{ts,tsx}': ['vitest related --run'],
};
