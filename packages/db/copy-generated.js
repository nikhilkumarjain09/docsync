const fs = require('fs');
const path = require('path');

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const srcDir = path.resolve(__dirname, 'src/generated/client');
const destDir = path.resolve(__dirname, 'dist/generated/client');

if (fs.existsSync(srcDir)) {
  console.log(`[db build] Copying generated client from ${srcDir} to ${destDir}...`);
  copyDirSync(srcDir, destDir);
  console.log('[db build] Copy complete.');
} else {
  console.warn(
    `[db build] Warning: Source directory ${srcDir} does not exist. Did you run prisma generate?`,
  );
}
