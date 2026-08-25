import { fileURLToPath } from 'node:url';
import { defineWorkspace } from 'vitest/config';

const fromRoot = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

const alias = {
  '@ideeza/domain': fromRoot('./packages/domain/src/index.ts'),
  '@ideeza/types': fromRoot('./packages/types/src/index.ts'),
  '@ideeza/db': fromRoot('./packages/db/src/index.ts'),
  '@ideeza/auth': fromRoot('./packages/auth/src/index.ts'),
  '@ideeza/ui': fromRoot('./packages/ui/src/index.ts'),
};

export default defineWorkspace([
  {
    resolve: { alias },
    test: {
      name: 'unit',
      environment: 'node',
      include: [
        'packages/domain/test/**/*.test.ts',
        'packages/types/test/**/*.test.ts',
        'packages/auth/test/**/*.test.ts',
        'packages/config/test/**/*.test.mjs',
        'apps/*/test/**/*.test.ts',
      ],
      // Suites suffixed .db.test.ts need a PostgreSQL cluster and run in the
      // database project instead.
      exclude: ['**/*.db.test.ts', '**/node_modules/**'],
    },
  },
  {
    resolve: { alias },
    esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
    test: {
      name: 'ui',
      environment: 'jsdom',
      include: ['packages/ui/test/**/*.test.tsx', 'apps/*/test/**/*.test.tsx'],
      setupFiles: ['packages/ui/test/setup.ts'],
      globals: false,
    },
  },
  {
    resolve: { alias },
    test: {
      name: 'database',
      environment: 'node',
      include: ['packages/db/test/**/*.test.ts', 'packages/*/test/**/*.db.test.ts'],
      // A throwaway PostgreSQL cluster is initialised per suite.
      testTimeout: 120_000,
      hookTimeout: 240_000,
      fileParallelism: false,
    },
  },
]);
