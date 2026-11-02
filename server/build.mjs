import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// shared/ is imported by relative path, so it is bundled; npm packages stay external.
await build({
  entryPoints: [fileURLToPath(new URL('./src/index.ts', import.meta.url))],
  outfile: fileURLToPath(new URL('./dist/index.js', import.meta.url)),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
});
