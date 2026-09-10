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

  it('loads package fallback, clipboard and output options', () => {
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ crashpack: { clipboard: false, out: 'report.md' } }));
    expect(loadConfig(tempDir)).toEqual({ clipboard: false, out: 'report.md' });
  });

  it('uses the first dedicated file without merging or falling back', () => {
    fs.writeFileSync(path.join(tempDir, '.crashpackrc'), '{"lines":20}');
    fs.writeFileSync(path.join(tempDir, '.crashpackrc.json'), '{"skip":["git"]}');
    expect(loadConfig(tempDir)).toEqual({ lines: 20 });
    fs.writeFileSync(path.join(tempDir, '.crashpackrc'), 'private malformed value');
    expect(() => loadConfig(tempDir)).toThrow('Invalid crashpack configuration');
  });

  it.each([null, [], { unknown: 'private value' }, { lines: 0 }, { lines: 1.5 }, { lines: Number.MAX_SAFE_INTEGER + 1 }, { only: 'git' }, { skip: [1] }, { redactExtra: [false] }, { clipboard: 'false' }, { out: ' ' }])('rejects malformed schema %j without exposing values', (value) => {
    fs.writeFileSync(path.join(tempDir, '.crashpackrc'), JSON.stringify(value));
    expect(() => loadConfig(tempDir)).toThrow('Invalid crashpack configuration');
  });

  it('ignores package metadata with no crashpack key', () => {
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name":"demo"}');
    expect(loadConfig(tempDir)).toBeNull();
  });

  it('does not search parent directories', () => {
    fs.writeFileSync(path.join(tempDir, '.crashpackrc'), '{"lines":20}');
    const child = path.join(tempDir, 'child');
    fs.mkdirSync(child);
    expect(loadConfig(child)).toBeNull();
  });

  it('rejects an invalid package config and malformed JSON with a generic error', () => {
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{"crashpack":{"lines":"private value"}}');
    expect(() => loadConfig(tempDir)).toThrow('Invalid crashpack configuration');
    fs.writeFileSync(path.join(tempDir, 'package.json'), 'malformed private value');
    expect(() => loadConfig(tempDir)).toThrow('Invalid crashpack configuration');
  });
});
