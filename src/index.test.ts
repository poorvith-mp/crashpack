import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createCrashPack } from './index.js';
import { renderMarkdown } from './render/markdown.js';
import { asRawText, Collector } from './types.js';
import { resolveSourcemapsInLog } from './sourcemap/resolve.js';

afterEach(() => vi.restoreAllMocks());

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

describe('sourcemap report ordering and privacy', () => {
  async function fixture(check: (cwd: string, log: string) => Promise<void>) {
    const cwd = fs.mkdtempSync(path.join(os.homedir(), 'crashpack-map-test-'));
    try {
      fs.writeFileSync(path.join(cwd, 'bundle.js'), 'throw new Error("synthetic");');
      fs.writeFileSync(path.join(cwd, 'bundle.js.map'), JSON.stringify({ version: 3, sources: ['src/main.ts'], mappings: 'AAAA' }));
      await check(cwd, `Error: DB_PASSWORD=synthetic-private-value\n    at main (${path.join(cwd, 'bundle.js').replace(/\\/g, '/')}:1:1)`);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  }
  it('resolves absolute home frames before final redaction, never exposing raw logs or evidence', async () => {
    await fixture(async (cwd, log) => {
      expect((await resolveSourcemapsInLog(log, cwd)).text).toContain('src/main.ts:1:1');
      const pack = await createCrashPack({ cwd, only: ['logs'], stdinLog: log, entropy: false });
      expect(pack.sections[0].content).toContain('src/main.ts:1:1');
      const output = JSON.stringify(pack) + renderMarkdown(pack);
      expect(output).not.toContain(cwd.replace(/\\/g, '/'));
      expect(output).not.toContain('synthetic-private-value');
      expect(output).not.toContain('versionSource');
      expect(pack.sections.every(s => s.data === undefined)).toBe(true);
      expect(pack.redactionCount).toBe(2);
    });
  });
  it('keeps no-sourcemaps disabled while redacting the original log', async () => {
    await fixture(async (cwd, log) => {
      const pack = await createCrashPack({ cwd, only: ['logs'], stdinLog: log, sourcemaps: false });
      expect(pack.sections[0].content).not.toContain('src/main.ts:1:1');
      expect(pack.sections[0].content).not.toContain('synthetic-private-value');
    });
  });
  it('uses only the remaining collection deadline for analysis', async () => {
    await fixture(async (cwd, log) => {
      let now = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => now);
      const pack = await createCrashPack({ cwd, deadlineMs: 5, collectors: [{ id: 'logs', title: 'Logs', fn: async () => { now = 5; return { id: 'logs', title: 'Logs', status: 'ok', rawContent: asRawText(log) }; } }] });
      expect(pack.sections[0].content).not.toContain('src/main.ts:1:1');
      expect(pack.sections[0].content).toContain('(sourcemap resolution stopped: budget)');
      expect(pack.sections[0].content).not.toContain('synthetic-private-value');
    });
  });
});
