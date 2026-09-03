import { describe, it, expect } from 'vitest';
import { createCrashPack } from './index.js';

describe('Runtime budget (B-07)', () => {
  // Docker is skipped: its availability varies by machine, so including it
  // makes this a flaky environment probe rather than a performance test.
  it('completes a warm run in under 2 seconds', async () => {
    const started = Date.now();
    await createCrashPack({ cwd: process.cwd(), skip: ['docker'] });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('degrades to unavailable rather than failing when the deadline fires', async () => {
    const pack = await createCrashPack({
      cwd: process.cwd(),
      deadlineMs: 1,
      collectors: [
        {
          id: 'git',
          title: 'Git',
          fn: () => new Promise(() => {}), // never settles
        },
      ],
    });

    expect(pack.sections).toHaveLength(1);
    expect(pack.sections[0].status).toBe('unavailable');
    expect(pack.sections[0].unavailableReason).toBe('exceeded global deadline');
  });
});
