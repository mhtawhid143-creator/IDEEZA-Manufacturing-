import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import legacyVocabulary from './packages/config/eslint/legacy-vocabulary.mjs';

const ideezaPlugin = {
  rules: {
    'legacy-vocabulary': legacyVocabulary,
  },
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      'packages/config/eslint/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    files: ['packages/domain/src/**/*.ts', 'packages/types/src/**/*.ts'],
    plugins: { ideeza: ideezaPlugin },
    rules: {
      'ideeza/legacy-vocabulary': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/test/**/*.ts'],
    rules: {
      'ideeza/legacy-vocabulary': 'off',
    },
  },
);
