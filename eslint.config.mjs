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
    // The design system's own components, copied in by
    // `tools/sync-design-system.mjs`. The rule above asks code to express the
    // system rather than invent values; this code *is* the system, so the rule
    // has nothing to tell it. It reaches for a primitive swatch where the
    // system's Figma spec names one (an outline badge's border) and for a
    // one-off shadow where the spec is a focus halo, and those choices belong
    // to the design team, not to this repository — a disable comment per line
    // would only be a note that the file was copied, which its README says.
    //
    // Nothing here is hand-edited, so nothing here can drift silently:
    // `node tools/sync-design-system.mjs --check` fails if it has.
    files: ['packages/ui/src/ds/**/*.{ts,tsx}'],
    rules: {
      'ideeza/design-tokens': 'off',
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
