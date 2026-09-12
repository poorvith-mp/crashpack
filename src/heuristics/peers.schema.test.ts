import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseSemver } from './semver.js';

describe('peers.json schema test (PMP-42)', () => {
  const peersPath = path.resolve('src/heuristics/peers.json');

  it('exists and has at least 25 entries', () => {
    expect(fs.existsSync(peersPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(peersPath, 'utf8'));
    expect(Array.isArray(content)).toBe(true);
    expect(content.length).toBeGreaterThanOrEqual(25);
  });

  it('validates every entry has required fields and valid URLs', () => {
    const content = JSON.parse(fs.readFileSync(peersPath, 'utf8'));
    for (const entry of content) {
      expect(entry.pkg, `Entry missing pkg: ${JSON.stringify(entry)}`).toBeTypeOf('string');
      expect(entry.range, `Entry missing range: ${JSON.stringify(entry)}`).toBeTypeOf('string');
      expect(entry.requires, `Entry missing requires: ${JSON.stringify(entry)}`).toBeTypeOf('object');
      expect(entry.requires.pkg, `Entry requires missing pkg: ${JSON.stringify(entry)}`).toBeTypeOf('string');
      expect(entry.requires.range, `Entry requires missing range: ${JSON.stringify(entry)}`).toBeTypeOf('string');
      expect(entry.source, `Entry missing source: ${JSON.stringify(entry)}`).toBeTypeOf('string');
      expect(entry.source.startsWith('http://') || entry.source.startsWith('https://'), `Invalid source URL: ${entry.source}`).toBe(true);

      // Validate semver ranges contain valid numbers
      const rangeParts = (entry.range + ' ' + entry.requires.range)
        .split(/[||\s><=^~]+/)
        .filter(Boolean);
      for (const part of rangeParts) {
        if (part === 'x' || part === '*') continue;
        const parsed = parseSemver(part);
        expect(parsed, `Failed to parse semver part '${part}' in ${entry.pkg}`).not.toBeNull();
      }
    }
  });
});
