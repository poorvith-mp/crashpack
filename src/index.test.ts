import { describe, it, expect } from 'vitest';
import { createCrashPack } from './index.js';
import { renderMarkdown } from './render/markdown.js';
import { asRawText, Collector } from './types.js';

const throwing = (message: string): Collector => async () => {
  throw new Error(message);
};

const reporting = (reason: string): Collector => async () => ({
  id: 'x',
  title: 'X',
  status: 'unavailable' as const,
  unavailableReason: reason,
});

describe('unavailableReason redaction (B-01)', () => {
  it('redacts secrets in a thrown collector error before rendering', async () => {
    const pack = await createCrashPack({
      collectors: [
        {
          id: 'git',
          title: 'Git',
          fn: throwing(
            'Command failed: git remote -v https://x-access-token:ghp_AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHH@github.com/o/r'
          ),
        },
      ],
    });

    const md = renderMarkdown(pack);
    expect(md).not.toContain('ghp_AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHH');
    expect(md).toContain('[redacted]');
  });

  it('redacts secrets in a collector-reported reason', async () => {
    const pack = await createCrashPack({
      collectors: [
        { id: 'env', title: 'Environment', fn: reporting('could not read DB_PASSWORD=hunter2swordfish') },
      ],
    });

    expect(pack.sections[0].unavailableReason).not.toContain('hunter2swordfish');
  });

  it('counts reason redactions toward redactionCount', async () => {
    const pack = await createCrashPack({
      collectors: [
        { id: 'git', title: 'Git', fn: throwing('token ghp_AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHH failed') },
      ],
    });

    expect(pack.redactionCount).toBeGreaterThan(0);
  });

  it('leaves a static reason untouched', async () => {
    const pack = await createCrashPack({
      collectors: [{ id: 'git', title: 'Git', fn: reporting('not a git repository') }],
    });

    expect(pack.sections[0].unavailableReason).toBe('not a git repository');
    expect(pack.redactionCount).toBe(0);
  });

  it('applies user --redact-extra patterns to reasons', async () => {
    const pack = await createCrashPack({
      collectors: [{ id: 'git', title: 'Git', fn: reporting('failed for tenant acme-corp') }],
      redactExtra: [/acme-corp/g],
    });

    expect(pack.sections[0].unavailableReason).not.toContain('acme-corp');
  });

  it('still degrades rather than failing the run when a collector throws', async () => {
    const pack = await createCrashPack({
      collectors: [
        { id: 'git', title: 'Git', fn: throwing('boom') },
        {
          id: 'system',
          title: 'System',
          fn: async () => ({ id: 'system', title: 'System', status: 'ok' as const, rawContent: asRawText('| OS | test |') }),
        },
      ],
    });

    expect(pack.sections).toHaveLength(2);
    expect(pack.sections.find((s) => s.id === 'system')?.status).toBe('ok');
  });
});
