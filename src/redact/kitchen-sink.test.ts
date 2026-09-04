import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createCrashPack } from '../index.js';
import { renderMarkdown } from '../render/markdown.js';

const FIXTURE = path.join(process.cwd(), 'fixtures', 'kitchen-sink');

const SECRETS = [
  'supersecretpass',
  'sk_test_51NzFAKE123456789',
  'AKIAIOSFODNN7EXAMPLE',
  'sk-proj-supersecretkey12345',
];

describe('Kitchen-sink corpus (B-02 end to end)', () => {
  it('names env keys without ever emitting a value', async () => {
    const pack = await createCrashPack({ cwd: FIXTURE, only: ['env'] });
    const md = renderMarkdown(pack);

    expect(md).toContain('DATABASE_URL');
    for (const secret of SECRETS) expect(md).not.toContain(secret);
  });

  it('redacts every credential when the same file is piped in as a crash log', async () => {
    // The realistic leak path: a dev server echoing its config on startup.
    const envDump = fs.readFileSync(path.join(FIXTURE, '.env'), 'utf8');

    const pack = await createCrashPack({
      cwd: FIXTURE,
      only: ['logs'],
      stdinLog: envDump,
    });
    const md = renderMarkdown(pack);

    for (const secret of SECRETS) expect(md).not.toContain(secret);
    expect(pack.redactionCount).toBeGreaterThanOrEqual(4);
  });

  it('leaves the report readable — keys survive, only values are masked', async () => {
    const envDump = fs.readFileSync(path.join(FIXTURE, '.env'), 'utf8');
    const pack = await createCrashPack({ cwd: FIXTURE, only: ['logs'], stdinLog: envDump });
    const md = renderMarkdown(pack);

    expect(md).toContain('DATABASE_URL');
    expect(md).toContain('STRIPE_KEY');
    expect(md).toContain('[redacted]');
  });
});
