import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadConfig } from './config.js';

describe('Crashpack Config Loader (PMP-43)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crashpack-config-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads json config from .crashpackrc', () => {
    fs.writeFileSync(
      path.join(tempDir, '.crashpackrc'),
      JSON.stringify({ only: ['git', 'env'], lines: 100 })
    );

    const config = loadConfig(tempDir);
    expect(config).toBeDefined();
    expect(config?.only).toEqual(['git', 'env']);
    expect(config?.lines).toBe(100);
  });

  it('loads toml config from .crashpackrc.toml', () => {
    fs.writeFileSync(
      path.join(tempDir, '.crashpackrc.toml'),
      `only = ["git", "runtimes"]\nlines = 50\n`
    );

    const config = loadConfig(tempDir);
    expect(config).toBeDefined();
    expect(config?.only).toEqual(['git', 'runtimes']);
    expect(config?.lines).toBe(50);
  });

  it('returns null when no config file exists', () => {
    expect(loadConfig(tempDir)).toBeNull();
  });
});
