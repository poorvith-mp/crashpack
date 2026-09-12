import { describe, expect, test } from 'vitest';
import { parsePowerShellPorts, collectPorts } from './ports.js';

describe('ports collector Windows behavior', () => {
  test('parsePowerShellPorts parses array of objects', () => {
    const json = JSON.stringify([{ LocalPort: 3000 }, { LocalPort: 5432 }]);
    const ports = parsePowerShellPorts(json);
    expect(ports).toEqual([3000, 5432]);
  });

  test('parsePowerShellPorts parses single object', () => {
    const json = JSON.stringify({ LocalPort: 8080 });
    const ports = parsePowerShellPorts(json);
    expect(ports).toEqual([8080]);
  });

  test('parsePowerShellPorts returns empty array on empty or invalid string', () => {
    expect(parsePowerShellPorts('')).toEqual([]);
    expect(parsePowerShellPorts('not-json')).toEqual([]);
  });

  describe.skipIf(process.platform !== 'win32')('live Windows execution', () => {
    test('collectPorts runs on Windows and returns valid status', async () => {
      const result = await collectPorts({ cwd: process.cwd() } as any);
      expect(['ok', 'unavailable']).toContain(result.status);
      expect(result.title).toBe('Ports');
    });
  });
});
