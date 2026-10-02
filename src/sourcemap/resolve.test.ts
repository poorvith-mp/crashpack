import { describe, it, expect, vi, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { resolveSourcemapsInLog } from './resolve.js';
import { redact } from '../redact/redact.js';

describe('Sourcemap resolver', () => {
  const cwd = path.resolve('.');

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('resolves external and inline sourcemap frames from fixtures/sourcemaps', async () => {
    const crashLog = fs.readFileSync('fixtures/sourcemaps/crash.log', 'utf8');
    const result = await resolveSourcemapsInLog(crashLog, cwd);

    // Shows original file:line:col with bundled location in brackets
    expect(result.text).toContain('fixtures/sourcemaps/_src.js:3:11');
    expect(result.text).toContain('[from fixtures/sourcemaps/bundle.js:4:11]');
    expect(result.text).toContain('fixtures/sourcemaps/_src.js:9:3');
    expect(result.text).toContain('[from fixtures/sourcemaps/bundle.js:9:3]');
    expect(result.text).toContain('[from fixtures/sourcemaps/inline.js:9:3]');
  });

  it('ignores external sourceMappingURL=https://... without calling fetch', async () => {
    const fetchSpy = vi.fn().mockImplementation(() => {
      throw new Error('fetch must never be called');
    });
    vi.stubGlobal('fetch', fetchSpy);

    const tmpJs = path.resolve('fixtures/sourcemaps/tmp-external.js');
    fs.writeFileSync(tmpJs, 'console.log("hi");\n//# sourceMappingURL=https://example.com/remote.map');

    try {
      const log = `Error: fail\n    at test (${path.relative(cwd, tmpJs).replace(/\\/g, '/')}:1:1)`;
      const result = await resolveSourcemapsInLog(log, cwd);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.text).toBe(log);
    } finally {
      if (fs.existsSync(tmpJs)) fs.unlinkSync(tmpJs);
    }
  });

  it('skips map paths outside cwd (path traversal guard)', async () => {
    const tmpJs = path.resolve('fixtures/sourcemaps/tmp-traversal.js');
    fs.writeFileSync(tmpJs, 'console.log("hi");\n//# sourceMappingURL=../../outside.map');

    try {
      const log = `Error: fail\n    at test (${path.relative(cwd, tmpJs).replace(/\\/g, '/')}:1:1)`;
      const result = await resolveSourcemapsInLog(log, cwd);
      expect(result.text).toBe(log);
    } finally {
      if (fs.existsSync(tmpJs)) fs.unlinkSync(tmpJs);
    }
  });

  it('skips indexed source map with a note line', async () => {
    const tmpJs = path.resolve('fixtures/sourcemaps/tmp-indexed.js');
    const tmpMap = path.resolve('fixtures/sourcemaps/tmp-indexed.js.map');
    fs.writeFileSync(tmpJs, 'console.log("hi");\n//# sourceMappingURL=tmp-indexed.js.map');
    fs.writeFileSync(tmpMap, JSON.stringify({ version: 3, sections: [] }));

    try {
      const log = `Error: fail\n    at test (${path.relative(cwd, tmpJs).replace(/\\/g, '/')}:1:1)`;
      const result = await resolveSourcemapsInLog(log, cwd);
      expect(result.notes).toContain('(sourcemap: indexed source maps not supported)');
    } finally {
      if (fs.existsSync(tmpJs)) fs.unlinkSync(tmpJs);
      if (fs.existsSync(tmpMap)) fs.unlinkSync(tmpMap);
    }
  });

  it('caps resolution at 200 frames and appends budget note', async () => {
    const lines = ['Error: bulk'];
    for (let i = 0; i < 250; i++) {
      lines.push(`    at calculate (fixtures/sourcemaps/bundle.js:4:11)`);
    }
    const log = lines.join('\n');
    const result = await resolveSourcemapsInLog(log, cwd);

    expect(result.resolvedCount).toBe(200);
    expect(result.notes).toContain('(sourcemap resolution stopped: budget)');
  });

  it('resolved output still passes through redaction', async () => {
    const tmpJs = path.resolve('fixtures/sourcemaps/tmp-alice.js');
    const tmpMap = path.resolve('fixtures/sourcemaps/tmp-alice.js.map');
    fs.writeFileSync(tmpJs, 'console.log("hi");\n//# sourceMappingURL=tmp-alice.js.map');
    fs.writeFileSync(
      tmpMap,
      JSON.stringify({
        version: 3,
        sources: ['C:\\Users\\alice\\project\\src\\index.ts'],
        mappings: ';AAAA',
      })
    );

    try {
      const log = `Error: fail\n    at test (${path.relative(cwd, tmpJs).replace(/\\/g, '/')}:2:1)`;
      const result = await resolveSourcemapsInLog(log, cwd);
      const redacted = redact(result.text);
      expect(redacted.text).not.toContain('C:\\Users\\alice');
      expect(redacted.text.replace(/\\/g, '/')).toContain('~/project/src/index.ts');
    } finally {
      if (fs.existsSync(tmpJs)) fs.unlinkSync(tmpJs);
      if (fs.existsSync(tmpMap)) fs.unlinkSync(tmpMap);
    }
  });

  it('does not resolve frames when the analysis budget is already exhausted', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const log = 'at calculate (fixtures/sourcemaps/bundle.js:4:11)';
    const result = await resolveSourcemapsInLog(log, cwd, { budgetMs: 0 });
    expect(result.resolvedCount).toBe(0);
    expect(result.text).toContain(log);
    expect(result.notes).toEqual(['(sourcemap resolution stopped: budget)']);
  });

  it('checks the elapsed budget during mapping parsing and leaves the frame intact', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const parse = JSON.parse;
    vi.spyOn(JSON, 'parse').mockImplementationOnce((text) => { const value = parse(text); now = 100; return value; });
    const log = 'at calculate (fixtures/sourcemaps/bundle.js:4:11)';
    const result = await resolveSourcemapsInLog(log, cwd, { budgetMs: 10 });
    expect(result.resolvedCount).toBe(0);
    expect(result.text).toContain(log);
    expect(result.notes).toEqual(['(sourcemap resolution stopped: budget)']);
  });
});
