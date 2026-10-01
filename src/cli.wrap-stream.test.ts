import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import { execa } from 'execa';
import { runCli } from './cli.js';

vi.mock('execa', () => ({ execa: vi.fn() }));
vi.mock('clipboardy', () => ({ default: { write: vi.fn() } }));

let stdout: string;
let live: Buffer[];
beforeEach(() => {
  stdout = ''; live = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => { stdout += String(chunk); return true; });
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => { live.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))); return true; });
});
afterEach(() => vi.restoreAllMocks());

async function capture(chunks: Buffer[], lines = 200): Promise<string> {
  vi.mocked(execa).mockImplementationOnce(() => {
    const all = new PassThrough();
    const done = new Promise((resolve) => setImmediate(() => {
      for (const chunk of chunks) all.emit('data', chunk);
      all.end();
      resolve({ exitCode: 7 });
    }));
    return Object.assign(done, { all }) as never;
  });
  const code = await runCli(['node', 'test', '--wrap', 'synthetic-child', '--json', '--only', 'logs', '--no-clipboard', '--no-sourcemaps', '--no-heuristics', '--lines', String(lines)]);
  expect(code).toBe(7);
  expect(Buffer.concat(live)).toEqual(Buffer.concat(chunks));
  return JSON.parse(stdout).sections.find((s: { id: string }) => s.id === 'logs').content;
}

describe('wrapped logical line capture', () => {
  it('joins split writes and flushes the final unterminated line', async () => {
    expect(await capture(['fir', 'st\nsec', 'ond'].map(s => Buffer.from(s)))).toBe('first\nsecond');
  });
  it('handles CRLF split across chunks without retaining a carriage return', async () => {
    expect(await capture(['one\r', '\ntwo\r', '\nlast'].map(s => Buffer.from(s)))).toBe('one\ntwo\nlast');
  });
  it('decodes split multibyte UTF-8 without changing live bytes', async () => {
    const bytes = Buffer.from('one 😀\nlast');
    expect(await capture([bytes.subarray(0, 6), bytes.subarray(6, 8), bytes.subarray(8)])).toBe('one 😀\nlast');
  });
  it('keeps the last N logical lines rather than chunk fragments or a trailing phantom line', async () => {
    expect(await capture(['discard\nfi', 'rst\nse', 'cond\nthird\n'].map(s => Buffer.from(s)), 2)).toBe('second\nthird');
  });
  it('bounds an overlong split line and retains the existing truncation notice', async () => {
    const line = 'x'.repeat(4000);
    expect(await capture([Buffer.from(line.slice(0, 1700)), Buffer.from(line.slice(1700)), Buffer.from('\nlast')])).toBe('x'.repeat(2000) + ' ... [line truncated at 2000 chars]\nlast');
  });
  it('keeps genuine empty lines inside the captured tail', async () => {
    expect(await capture([Buffer.from('first\n\nlast')], 2)).toBe('\nlast');
  });
});
