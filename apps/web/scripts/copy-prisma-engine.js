/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * copy-prisma-engine.js
 *
 * Copies the Prisma query engine binary from packages/db/src/generated/client/
 * into apps/web/src/generated/client/ so that Vercel's serverless function
 * bundler (Turbopack) includes it in the deployment.
 *
 * This is necessary because Turbopack does not reliably honour
 * `outputFileTracingIncludes` for binary .node files located outside the
 * web app's directory tree.
 *
 * Prisma already searches /var/task/apps/web/src/generated/client at runtime
 * on Vercel, so placing the engine there guarantees it will be found.
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../../../packages/db/src/generated/client');
const destDir = path.resolve(__dirname, '../src/generated/client');

if (!fs.existsSync(srcDir)) {
  console.error(`[copy-prisma-engine] ERROR: Source directory does not exist: ${srcDir}`);
  console.error('[copy-prisma-engine] Did you run "prisma generate" first?');
  process.exit(1);
}

// Create destination directory
fs.mkdirSync(destDir, { recursive: true });

const files = fs.readdirSync(srcDir);
let copied = 0;

for (const file of files) {
  // Copy engine binaries and the schema (Prisma needs schema.prisma next to the engine)
  if (file.includes('libquery_engine') || file === 'schema.prisma') {
    const srcFile = path.join(srcDir, file);
    const destFile = path.join(destDir, file);
    fs.copyFileSync(srcFile, destFile);
    console.log(`[copy-prisma-engine] Copied ${file}`);
    copied++;
  }
}

if (copied === 0) {
  console.warn('[copy-prisma-engine] WARNING: No engine binaries found to copy.');
  console.warn('[copy-prisma-engine] Searched in:', srcDir);
} else {
  console.log(`[copy-prisma-engine] Done — ${copied} file(s) copied to ${destDir}`);
}
