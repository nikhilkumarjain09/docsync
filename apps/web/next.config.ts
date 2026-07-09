import type { NextConfig } from 'next';
import path from 'path';

const nextConfig = {
  /* config options here */
  serverExternalPackages: ['yjs', 'y-prosemirror'],
  turbopack: {
    resolveAlias: {
      yjs: './node_modules/yjs',
      'y-prosemirror': './node_modules/y-prosemirror',
    },
  },
  webpack: (config: any) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      yjs: path.resolve(__dirname, 'node_modules/yjs'),
      'y-prosemirror': path.resolve(__dirname, 'node_modules/y-prosemirror'),
    };
    return config;
  },
} as any;

export default nextConfig;
