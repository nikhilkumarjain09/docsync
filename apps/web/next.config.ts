import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['yjs', 'y-prosemirror'],
  outputFileTracingIncludes: {
    '/*': ['../../packages/db/dist/generated/client/libquery_engine-*.node'],
    '/api/**/*': ['../../packages/db/dist/generated/client/libquery_engine-*.node'],
  },
  turbopack: {
    resolveAlias: {
      yjs: './node_modules/yjs',
      'y-prosemirror': './node_modules/y-prosemirror',
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webpack: (config: any) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      yjs: path.resolve(__dirname, 'node_modules/yjs'),
      'y-prosemirror': path.resolve(__dirname, 'node_modules/y-prosemirror'),
    };
    return config;
  },
};

export default nextConfig;
