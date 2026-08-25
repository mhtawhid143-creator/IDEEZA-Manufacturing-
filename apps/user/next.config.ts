import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The workspace packages ship TypeScript sources, so Next compiles them.
  transpilePackages: ['@ideeza/ui', '@ideeza/domain', '@ideeza/types', '@ideeza/auth', '@ideeza/db'],
  eslint: {
    // Linting runs once for the whole monorepo through the root eslint config.
    ignoreDuringBuilds: true,
  },
  webpack: (webpackConfig) => {
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
