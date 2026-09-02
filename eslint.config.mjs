import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import legacyVocabulary from './packages/config/eslint/legacy-vocabulary.mjs';
import designTokens from './packages/config/eslint/design-tokens.mjs';

const ideezaPlugin = {
  rules: {
    'legacy-vocabulary': legacyVocabulary,
    'design-tokens': designTokens,
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
      // Vendored design-system sources (see packages/ds-ui/VENDORED.md):
      // the design team's code, synced verbatim, linted by whoever ships it.
      'packages/ds-ui/src/**',
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
    // What the panels draw: every colour and measure of appearance in the
    // design-system package and both apps comes from the system's tokens.
    files: ['packages/ui/src/**/*.{ts,tsx}', 'apps/*/src/**/*.{ts,tsx}'],
    plugins: { ideeza: ideezaPlugin },
    rules: {
      'ideeza/design-tokens': 'error',
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
    // Repository tooling: node scripts, some of which drive a browser. A
    // package's own scripts directory is the same kind of thing — it runs in
    // node during a build, not in the app.
    files: [
      'tools/**/*.mjs',
      'tools/**/*.ts',
      'packages/*/scripts/**/*.mjs',
      'packages/*/scripts/**/*.ts',
      '*.mjs',
      '*.ts',
    ],
    languageOptions: {
      globals: { ...NODE_GLOBALS, ...BROWSER_GLOBALS },
    },
  },
);
