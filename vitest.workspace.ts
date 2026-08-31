import { fileURLToPath } from 'node:url';
import { defineWorkspace } from 'vitest/config';

const fromRoot = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

const packages = {
  '@ideeza/domain': fromRoot('./packages/domain/src/index.ts'),
  '@ideeza/types': fromRoot('./packages/types/src/index.ts'),
  '@ideeza/db': fromRoot('./packages/db/src/index.ts'),
  '@ideeza/auth': fromRoot('./packages/auth/src/index.ts'),
  '@ideeza/ui': fromRoot('./packages/ui/src/index.ts'),
  // Subpath entries must sit before the bare name so the prefix match cannot
  // swallow them.
  '@ideeza/ds/button': fromRoot('./packages/ds-ui/src/components/Button/index.ts'),
  '@ideeza/ds/field': fromRoot('./packages/ds-ui/src/components/Field/index.ts'),
  '@ideeza/ds/cn': fromRoot('./packages/ds-ui/src/lib/cn.ts'),
  '@ideeza/ds': fromRoot('./packages/ds-ui/src/index.ts'),
};

/** The buyer app's own path alias, so its data layer can be tested directly. */
const alias = { '@': fromRoot('./apps/user/src'), ...packages };

/** The same for the manufacturer app, which has its own '@'. */
const manufacturerAlias = { '@': fromRoot('./apps/manufacturer/src'), ...packages };

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
        'packages/db/test/events.test.ts',
        'apps/user/test/**/*.test.ts',
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
      include: ['packages/ui/test/**/*.test.tsx', 'apps/user/test/**/*.test.tsx'],
      setupFiles: ['packages/ui/test/setup.ts'],
      globals: false,
    },
  },
  {
    resolve: { alias },
    test: {
      name: 'database',
      environment: 'node',
      include: [
        'packages/db/test/**/*.test.ts',
        'packages/*/test/**/*.db.test.ts',
        'apps/user/test/**/*.db.test.ts',
      ],
      // Runs in the unit project: it reads the generated enum, not a cluster.
      exclude: ['packages/db/test/events.test.ts', '**/node_modules/**'],
      // A throwaway PostgreSQL cluster is initialised per suite.
      testTimeout: 120_000,
      hookTimeout: 240_000,
      fileParallelism: false,
    },
  },
  {
    resolve: { alias: manufacturerAlias },
    test: {
      name: 'unit-manufacturer',
      environment: 'node',
      include: ['apps/manufacturer/test/**/*.test.ts'],
      exclude: ['**/*.db.test.ts', '**/node_modules/**'],
    },
  },
  {
    resolve: { alias: manufacturerAlias },
    test: {
      name: 'database-manufacturer',
      environment: 'node',
      include: ['apps/manufacturer/test/**/*.db.test.ts'],
      exclude: ['**/node_modules/**'],
      testTimeout: 120_000,
      hookTimeout: 240_000,
      fileParallelism: false,
    },
  },
]);
