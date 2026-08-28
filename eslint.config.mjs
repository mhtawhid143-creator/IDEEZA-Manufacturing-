import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import legacyVocabulary from './packages/config/eslint/legacy-vocabulary.mjs';

const ideezaPlugin = {
  rules: {
    'legacy-vocabulary': legacyVocabulary,
  },
};

const NODE_GLOBALS = {
  process: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  URL: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
};

/** Code that runs inside the browser through Playwright's page.evaluate. */
const BROWSER_GLOBALS = {
  document: 'readonly',
  window: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      '**/.next/**',
      '**/next-env.d.ts',
      '**/.verify-shots/**',
      'packages/config/eslint/**',
      // Tooling installed into the repository by an agent-skill installer
      // (impeccable). Third-party sources, linted by whoever ships them.
      '.agent/**',
      '.agents/**',
      '.claude/**',
      '.codex/**',
      '.gemini/**',
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
  {
    // Build tooling: commonjs config files.
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', require: 'readonly', ...NODE_GLOBALS },
    },
    rules: {
      // Tailwind and postcss load these files with require, by design.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Repository tooling: node scripts, some of which drive a browser.
    files: ['tools/**/*.mjs', 'tools/**/*.ts', '*.mjs', '*.ts'],
    languageOptions: {
      globals: { ...NODE_GLOBALS, ...BROWSER_GLOBALS },
    },
  },
);
