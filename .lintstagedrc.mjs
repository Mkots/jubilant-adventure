export default {
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    'git add'
  ],
  '*.{json,md,yml,yaml}': [
    'prettier --write',
    'git add'
  ],
  '**/*.test.{ts,tsx}': [
    'jest --bail --findRelatedTests --passWithNoTests'
  ]
};