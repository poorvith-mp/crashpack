import { describe, expect, test } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOsName, collectSystem } from './system.js';

describe('Windows 11 and System collector', () => {
  test('does not contain wmic in source file', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const sourcePath = path.join(__dirname, 'system.ts');
    const content = fs.readFileSync(sourcePath, 'utf8');
    expect(content.toLowerCase()).not.toContain('wmic');
  });

  test('identifies Windows 11 when build >= 22000', () => {
    const name = getOsName('win32', '10.0.22631', 'x64');
    expect(name).toBe('Windows 11 (build 22631) (x64)');
  });

  test('identifies Windows 10 when build < 22000', () => {
    const name = getOsName('win32', '10.0.19045', 'x64');
    expect(name).toBe('Windows 10 (build 19045) (x64)');
  });

  test('formats edition correctly when provided', () => {
    const name = getOsName('win32', '10.0.22631', 'x64', 'Microsoft Windows 11 Pro');
    expect(name).toBe('Windows 11 Pro (build 22631) (x64)');
  });

  test('collectSystem runs without error on current system', async () => {
    const res = await collectSystem({ cwd: process.cwd() } as any);
    expect(res.status).toBe('ok');
    expect(res.title).toBe('System');
  });
});
