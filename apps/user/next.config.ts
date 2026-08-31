import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const fromRoot = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

const config: NextConfig = {
  reactStrictMode: true,
  // The workspace packages ship TypeScript sources, so Next compiles them.
  transpilePackages: ['@ideeza/ui', '@ideeza/ds', '@ideeza/domain', '@ideeza/types', '@ideeza/auth', '@ideeza/db'],
  eslint: {
    // Linting runs once for the whole monorepo through the root eslint config.
    ignoreDuringBuilds: true,
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.alias = {
      ...(webpackConfig.resolve.alias ?? {}),
      // The package ships sources, so the edge-safe entry point is resolved to
      // its file rather than through the published export map. The middleware
      // imports it to stay out of the password hasher, which needs node:crypto
      // and cannot be bundled for the edge.
      '@ideeza/auth/edge$': fromRoot('../../packages/auth/src/edge.ts'),
    };

    // The workspace sources use the ".js" specifier that NodeNext requires.
    // Webpack needs to be told that it resolves to the TypeScript file.
    webpackConfig.resolve.extensionAlias = {
      ...(webpackConfig.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return webpackConfig;
  },
};

export default config;
