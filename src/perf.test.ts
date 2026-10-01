import { describe, it, expect, vi } from 'vitest';
import { createCrashPack } from './index.js';

describe('Runtime budget (B-07)', () => {
  it('counts synchronous collector setup toward the collection deadline', async () => {
    vi.useFakeTimers();
    try {
      let settled = false;
      const pending = createCrashPack({
        deadlineMs: 10,
        collectors: [{ id: 'git', title: 'Git', fn: () => {
          vi.advanceTimersByTime(10);
          return new Promise(() => {});
        } }],
      }).then(pack => { settled = true; return pack; });
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toBe(true);
      expect((await pending).sections[0].unavailableReason).toBe('exceeded global deadline');
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears deadline timers when collectors finish', async () => {
    vi.useFakeTimers();
    try {
      await createCrashPack({ only: ['logs'], stdinLog: 'Synthetic timer-cleanup log' });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * Asserts the ceiling crashpack actually enforces, not the typical case.
   * Vitest runs files in parallel, so wall-clock here includes contention from
   * the rest of the suite — this measured 1.4s alone and 4.5s under full load.
   * "Typically under two seconds" is a benchmark, run it alone to check:
   *   npx vitest run src/perf.test.ts
   *
   * Docker is skipped: its availability varies by machine, so including it
   * makes this an environment probe rather than a performance test.
   */
  it('stays within the enforced deadline', async () => {
    const started = Date.now();
    const pack = await createCrashPack({ cwd: process.cwd(), skip: ['docker'] });

    expect(Date.now() - started).toBeLessThan(6000);
    expect(pack.sections.every((s) => s.unavailableReason !== 'exceeded global deadline')).toBe(true);
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
