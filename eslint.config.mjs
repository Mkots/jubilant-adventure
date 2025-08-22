import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';

export default [
    eslint.configs.recommended,
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
                project: './tsconfig.json',
            },
            globals: {
                // Vitest глобальные переменные
                describe: 'readonly',
                test: 'readonly',
                it: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                vi: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
            prettier,
        },
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            'no-console': 'error',
            'no-unsafe-negation': 'error',
            'no-undef': 'off',
            strict: ['error', 'never'],
            'prettier/prettier': 'error',
        },
    },
    {
        files: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
        rules: {
            'no-console': 'off',
        },
    },
    {
        ignores: [
            'node_modules/**',
            'coverage/**',
            'dist/**',
            '*.js',
        ],
    },
];