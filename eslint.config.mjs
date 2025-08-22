import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import jest from 'eslint-plugin-jest';
import prettier from 'eslint-plugin-prettier';

export default [
// Base ESLint recommended rules
eslint.configs.recommended,

// TypeScript files
{
files: ['**/*.ts', '**/*.tsx'],
languageOptions: {
parser: tsparser,
parserOptions: {
ecmaVersion: 2022,
sourceType: 'module',
project: './tsconfig.json'
}
},
plugins: {
'@typescript-eslint': tseslint,
prettier
},
rules: {
// TypeScript specific rules
'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
'@typescript-eslint/explicit-function-return-type': 'off',
'@typescript-eslint/explicit-module-boundary-types': 'off',
'@typescript-eslint/no-explicit-any': 'warn',

// General rules
'no-console': 'error',
'no-unsafe-negation': 'error',
'no-undef': 'off', // TypeScript handles this
'strict': ['error', 'never'],

// Prettier integration
'prettier/prettier': 'error'
}
},

// Test files
{
files: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
plugins: {
jest
},
languageOptions: {
globals: {
...jest.environments.globals.globals
}
},
rules: {
...jest.configs.recommended.rules,
'jest/no-disabled-tests': 'warn',
'jest/no-focused-tests': 'error',
'jest/no-identical-title': 'error',
'jest/prefer-to-have-length': 'warn',
'jest/valid-expect': 'error',
'no-console': 'off' // Allow console in tests
}
},

// Ignore patterns
{
ignores: [
'node_modules/**',
'coverage/**',
'dist/**',
'*.js' // Ignore JS files in root (like this config)
]
}
];