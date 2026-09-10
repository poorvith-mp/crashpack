import { build } from 'tsup';
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = resolve(root, 'site-dist');
if (resolve('.') !== root || dirname(output) !== root) throw new Error('Run the site build from the repository root.');
// Recreate only this repository's generated website output.
await rm(output, { recursive: true, force: true });
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('site-dist/assets', { recursive: true });
await build({ entry: ['docs/site.ts'], format: ['esm'], outDir: 'site-dist/assets', minify: true, config: false, splitting: false, target: 'es2022' });
for (const file of ['index.html', 'guide.html', '404.html', 'style.css', '_headers', 'sample-report.md']) {
  const content = await readFile(`docs/${file}`, 'utf8');
  await writeFile(`site-dist/${file}`, content.replaceAll('{{VERSION}}', version));
}
await cp('docs/assets', 'site-dist/assets', { recursive: true });
const bytes = gzipSync(await readFile('site-dist/assets/site.js')).length;
if (bytes > 40 * 1024) throw new Error(`Website script exceeds 40 KiB gzip: ${bytes}`);
const commit = process.env.CF_PAGES_COMMIT_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
await writeFile('site-dist/build.json', JSON.stringify({ version, commit, scriptGzipBytes: bytes }, null, 2));
console.log(`Website built: ${version}; ${commit}; complete script ${bytes} bytes gzip (40 KiB budget).`);
