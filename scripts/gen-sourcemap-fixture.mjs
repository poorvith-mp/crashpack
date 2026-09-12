import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const outDir = path.resolve('fixtures/sourcemaps');
fs.mkdirSync(outDir, { recursive: true });

const srcFile = path.join(outDir, '_src.js');
fs.writeFileSync(
  srcFile,
  `export function calculate(x) {
  if (x <= 0) {
    throw new Error('invalid input');
  }
  return x * 2;
}

export function main() {
  calculate(0);
}
`
);

// 1. External map: bundle.js and bundle.js.map
execFileSync(
  'npx',
  ['esbuild', srcFile, '--bundle', '--sourcemap', `--outfile=${path.join(outDir, 'bundle.js')}`, '--format=esm'],
  { shell: true }
);

// 2. Inline map: inline.js
execFileSync(
  'npx',
  ['esbuild', srcFile, '--bundle', '--sourcemap=inline', `--outfile=${path.join(outDir, 'inline.js')}`, '--format=esm'],
  { shell: true }
);

// Clean up the temporary source file
fs.unlinkSync(srcFile);

// 3. Create crash.log with 3 stack frames
const crashLog = `Error: invalid input
    at calculate (fixtures/sourcemaps/bundle.js:3:11)
    at main (fixtures/sourcemaps/bundle.js:9:3)
    at Object.<anonymous> (fixtures/sourcemaps/inline.js:9:3)
`;

fs.writeFileSync(path.join(outDir, 'crash.log'), crashLog, 'utf8');
console.log('Sourcemap fixtures generated in fixtures/sourcemaps/');
