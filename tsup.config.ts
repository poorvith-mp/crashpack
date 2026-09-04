import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  // Single source of truth for the version string (B-15)
  define: { __CRASHPACK_VERSION__: JSON.stringify(version) },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  shims: true,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
