import { describe, expect, test, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadConfig } from './config.js';

describe('Config git-root walkup & v0.4.0 schema', () => {
  const tempDirs: string[] = [];

  function createTempDir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-test-'));
    tempDirs.push(d);
    return d;
  }

  afterEach(() => {
    vi.restoreAllMocks();
    for (const d of tempDirs) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
      } catch {}
    }
    tempDirs.length = 0;
  });

  test('walks up from subdirectory to git root to find .crashpackrc.json', () => {
    const root = createTempDir();
    fs.mkdirSync(path.join(root, '.git'));
    const sub = path.join(root, 'packages', 'client');
    fs.mkdirSync(sub, { recursive: true });

    fs.writeFileSync(
      path.join(root, '.crashpackrc.json'),
      JSON.stringify({ template: 'envinfo', issueTitlePrefix: '[BUG]' })
    );

    const config = loadConfig(sub);
    expect(config).not.toBeNull();
    expect(config?.template).toBe('envinfo');
    expect(config?.issueTitlePrefix).toBe('[BUG]');
  });

  test('nearest config wins and does not merge with ancestor', () => {
    const root = createTempDir();
    fs.mkdirSync(path.join(root, '.git'));
    const sub = path.join(root, 'packages', 'client');
    fs.mkdirSync(sub, { recursive: true });

    fs.writeFileSync(
      path.join(root, '.crashpackrc.json'),
      JSON.stringify({ template: 'envinfo', lines: 50 })
    );

    fs.writeFileSync(
      path.join(sub, '.crashpackrc.json'),
      JSON.stringify({ template: 'minimal' })
    );

    const config = loadConfig(sub);
    expect(config?.template).toBe('minimal');
    // Not merged: lines from root should be undefined
    expect(config?.lines).toBeUndefined();
  });

  test('accepts valid sections array and emits stderr warning on unknown section', () => {
    const root = createTempDir();
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    fs.writeFileSync(
      path.join(root, '.crashpackrc.json'),
      JSON.stringify({
        sections: ['system', 'runtimes', 'unknown_custom_section'],
      })
    );

    const config = loadConfig(root);
    expect(config?.sections).toContain('system');
    expect(config?.sections).toContain('unknown_custom_section');
    expect(stderrSpy).toHaveBeenCalled();
  });

  test('rejects invalid template in config', () => {
    const root = createTempDir();
    fs.writeFileSync(
      path.join(root, '.crashpackrc.json'),
      JSON.stringify({ template: 'invalid_template' })
    );

    expect(() => loadConfig(root)).toThrowError(/Invalid crashpack configuration/);
  });
});
