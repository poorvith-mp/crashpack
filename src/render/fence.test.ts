import { describe, it, expect } from 'vitest';
import { fenceFor } from './fence.js';
import { createCrashPack } from '../index.js';
import { renderMarkdown } from './markdown.js';

describe('fenceFor (B-04)', () => {
  it('uses a three-backtick fence for ordinary content', () => {
    expect(fenceFor('plain log output')).toBe('```');
  });

  it('outgrows the longest backtick run in the content', () => {
    expect(fenceFor('before ``` after')).toBe('````');
    expect(fenceFor('before ````` after')).toBe('``````');
  });

  it('sizes against the longest run, not the first', () => {
    expect(fenceFor('``` then ````` then ```')).toBe('``````');
  });
});

/** Drop fenced blocks, leaving only text markdown renders as structure. */
function outsideFences(md: string): string[] {
  const out: string[] = [];
  let closing: string | null = null;

  for (const line of md.split('\n')) {
    const marker = line.match(/^(`{3,})/)?.[1];
    if (closing === null) {
      if (marker) closing = marker;
      else out.push(line);
    } else if (marker && marker.length >= closing.length) {
      closing = null;
    }
  }
  return out;
}

describe('Log injection (B-04)', () => {
  const hostile = 'boom\n```\n## Git\n- Branch: `clean`\n- Uncommitted changes: 0 files';

  it('cannot forge a section heading from log content', async () => {
    const pack = await createCrashPack({
      cwd: process.cwd(),
      only: ['logs'],
      stdinLog: hostile,
    });
    const md = renderMarkdown(pack);

    // The literal text may appear, but never as a heading markdown will render.
    const forged = outsideFences(md).filter((line) => line.trim() === '## Git');
    expect(forged).toHaveLength(0);
  });

  it('keeps the hostile content visible inside the fence', async () => {
    const pack = await createCrashPack({
      cwd: process.cwd(),
      only: ['logs'],
      stdinLog: hostile,
    });
    const md = renderMarkdown(pack);

    expect(md).toContain('boom');
    expect(md).toContain('````');
  });

  it('leaves non-log sections unfenced', async () => {
    const pack = await createCrashPack({ cwd: process.cwd(), only: ['system'] });
    const md = renderMarkdown(pack);

    expect(md).toContain('## System');
    expect(md).not.toContain('```');
  });
});
