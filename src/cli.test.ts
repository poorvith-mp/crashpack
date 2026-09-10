import { describe, it, expect } from 'vitest';
import { createCrashPack } from './index.js';
import { renderMarkdown } from './render/markdown.js';

describe('CLI & Orchestration', () => {
  it('creates a crashpack and passes all sections through redaction', async () => {
    const pack = await createCrashPack({
      cwd: process.cwd(),
      timeoutMs: 2000,
    });

    expect(pack.projectName).toBeDefined();
    expect(pack.sections.length).toBeGreaterThan(0);
    expect(typeof pack.durationMs).toBe('number');
    expect(typeof pack.redactionCount).toBe('number');

    const markdown = renderMarkdown(pack);
    expect(markdown).toContain('# crashpack ·');
    expect(markdown).toContain('Redaction can miss secrets; review before sharing.');
  });

  it('respects --only filter', async () => {
    const pack = await createCrashPack({
      cwd: process.cwd(),
      only: ['system', 'runtimes'],
    });

    const ids = pack.sections.map((s) => s.id);
    expect(ids).toContain('system');
    expect(ids).toContain('runtimes');
    expect(ids).not.toContain('git');
    expect(ids).not.toContain('docker');
  });

  it('respects --skip filter', async () => {
    const pack = await createCrashPack({
      cwd: process.cwd(),
      skip: ['docker', 'ports'],
    });

    const ids = pack.sections.map((s) => s.id);
    expect(ids).not.toContain('docker');
    expect(ids).not.toContain('ports');
    expect(ids).toContain('system');
  });

  it('captures wrapped logs when buffer is provided', async () => {
    const pack = await createCrashPack({
      cwd: process.cwd(),
      wrapBuffer: 'Error: Unhandled exception in server.ts\nFatal crash at port 3000',
    });

    const logSection = pack.sections.find((s) => s.id === 'logs');
    expect(logSection).toBeDefined();
    expect(logSection?.status).toBe('ok');
    expect(logSection?.content).toContain('Unhandled exception');
  });

  it('passes --since parameter to git collector', async () => {
    const pack = await createCrashPack({
      cwd: process.cwd(),
      since: '1d',
      only: ['git'],
    });

    const gitSection = pack.sections.find((s) => s.id === 'git');
    expect(gitSection).toBeDefined();
    if (gitSection?.status === 'ok') {
      expect(gitSection.content).toContain('Commits since 1d');
    }
  });
});
