import { describe, expect, test } from 'vitest';
import { renderReport } from './markdown.js';
import { CrashPack, asRawText, SafeText } from '../types.js';

function makeMockPack(): CrashPack {
  return {
    projectName: 'test-app',
    generatedAt: '2026-09-12 11:30:00 UTC',
    durationMs: 450,
    redactionCount: 2,
    sections: [
      {
        id: 'system',
        title: 'System',
        status: 'ok',
        content: '| | |\n|---|---|\n| OS | Windows 11 (build 22631) (x64) |\n| CPU | AMD Ryzen, 16 cores |\n| Memory | 8 GB free of 16 GB |' as SafeText,
        durationMs: 10,
      },
      {
        id: 'runtimes',
        title: 'Runtimes',
        status: 'ok',
        content: '- Node `22.13.1`\n- npm `10.9.2`' as SafeText,
        data: { Node: '22.13.1', npm: '10.9.2' },
        durationMs: 15,
      },
      {
        id: 'packages',
        title: 'Packages',
        status: 'ok',
        content: '| Package | Version |\n|---|---|\n| next | 15.0.3 |\n| react | 19.0.0 |' as SafeText,
        data: [
          { name: 'next', version: '15.0.3' },
          { name: 'react', version: '19.0.0' },
        ],
        durationMs: 20,
      },
      {
        id: 'docker',
        title: 'Docker',
        status: 'ok',
        content: '- Docker `24.0.5`' as SafeText,
        durationMs: 10,
      },
      {
        id: 'logs',
        title: 'Logs',
        status: 'ok',
        content: 'Error: Database connection failed' as SafeText,
        durationMs: 5,
      },
      {
        id: 'git',
        title: 'Git',
        status: 'ok',
        content: 'branch: main\ncommit: abc1234' as SafeText,
        durationMs: 8,
      },
    ],
  };
}

describe('renderReport templates', () => {
  test('default template renders standard headings', () => {
    const pack = makeMockPack();
    const output = renderReport(pack, 'default');
    expect(output).toContain('# crashpack · test-app');
    expect(output).toContain('## System');
    expect(output).toContain('## Runtimes');
    expect(output).toContain('## Packages');
    expect(output).toContain('## Docker');
    expect(output).toContain('## Logs');
    expect(output).toContain('## Git');
  });

  test('minimal template renders only System, Runtimes, and Logs', () => {
    const pack = makeMockPack();
    const output = renderReport(pack, 'minimal');
    expect(output).toContain('# crashpack · test-app');
    expect(output).toContain('## System');
    expect(output).toContain('## Runtimes');
    expect(output).toContain('## Logs');
    expect(output).not.toContain('## Packages');
    expect(output).not.toContain('## Docker');
    expect(output).not.toContain('## Git');
  });

  test('envinfo template renders System, Binaries, npmPackages followed by Logs and Git', () => {
    const pack = makeMockPack();
    const output = renderReport(pack, 'envinfo');
    expect(output).toContain('  System:');
    expect(output).toContain('    OS: Windows 11 (build 22631) (x64)');
    expect(output).toContain('  Binaries:');
    expect(output).toContain('    Node: 22.13.1');
    expect(output).toContain('    npm: 10.9.2');
    expect(output).toContain('  npmPackages:');
    expect(output).toContain('    next: 15.0.3');
    expect(output).toContain('    react: 19.0.0');
    expect(output).toContain('## Logs');
    expect(output).toContain('Database connection failed');
    expect(output).toContain('## Git');
    expect(output).toContain('branch: main');
    expect(output).not.toContain('## Docker');
  });

  test('unknown template throws error with exitCode 2', () => {
    const pack = makeMockPack();
    expect(() => renderReport(pack, 'invalid-template')).toThrowError(/Unknown template/);
    try {
      renderReport(pack, 'invalid-template');
    } catch (err: any) {
      expect(err.exitCode).toBe(2);
    }
  });

  test('envinfo includes redacted findings after fixed headings and before logs without changing minimal', () => {
    const pack = makeMockPack();
    pack.sections.unshift({ id: 'likely-cause', title: 'Likely Cause', status: 'ok', content: '- Vite needs a supported Node version; secret=[redacted]' as SafeText, durationMs: 0 });
    const output = renderReport(pack, 'envinfo');
    expect(output).toContain('## Likely Cause');
    expect(output).toContain('secret=[redacted]');
    expect(output.indexOf('npmPackages:')).toBeLessThan(output.indexOf('## Likely Cause'));
    expect(output.indexOf('## Likely Cause')).toBeLessThan(output.indexOf('## Logs'));
    expect(renderReport(pack, 'minimal')).not.toContain('Likely Cause');
    expect(renderReport(makeMockPack(), 'envinfo')).not.toContain('Likely Cause');
  });
});
