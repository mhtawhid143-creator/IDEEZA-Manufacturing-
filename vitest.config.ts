import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolveFromRoot = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@ideeza/domain': resolveFromRoot('./packages/domain/src/index.ts'),
      '@ideeza/types': resolveFromRoot('./packages/types/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'packages/*/test/**/*.test.mjs'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['packages/domain/src/**', 'packages/types/src/**'],
    },
  },
});
