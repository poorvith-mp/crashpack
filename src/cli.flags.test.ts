import { describe, it, expect, vi, afterEach } from 'vitest';
import { runCli } from './cli.js';

describe('CLI flags & help groups (v0.4.0)', () => {
  let stdoutData = '';
  let stderrData = '';

  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((str) => {
    stdoutData += str;
    return true;
  });

  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((str) => {
    stderrData += str;
    return true;
  });

  afterEach(() => {
    stdoutData = '';
    stderrData = '';
    vi.clearAllMocks();
  });

  it('renders help with grouped sections: Input, Output, Collection, Analysis, Issue', async () => {
    let exitCode: number | undefined;
    try {
      await runCli(['node', 'crashpack', '--help']);
    } catch (e: any) {
      exitCode = e.exitCode;
    }

    const helpOutput = stdoutData || stderrData;
    expect(helpOutput).toContain('Input:');
    expect(helpOutput).toContain('Output:');
    expect(helpOutput).toContain('Collection:');
    expect(helpOutput).toContain('Analysis:');
    expect(helpOutput).toContain('Issue:');
    expect(helpOutput).toContain('--template');
    expect(helpOutput).toContain('--no-sourcemaps');
    expect(helpOutput).toContain('--no-heuristics');
  });

  it('rejects unknown template with exit code 2 and lists valid templates', async () => {
    const code = await runCli(['node', 'crashpack', '--no-clipboard', '--stdout', '--template', 'invalid_tmpl']);
    expect(code).toBe(2);
    expect(stderrData).toContain('Unknown template "invalid_tmpl"');
    expect(stderrData).toContain('Available: default, envinfo, minimal');
  });

  it('renders minimal template with System, Runtimes, Logs only', async () => {
    const code = await runCli(['node', 'crashpack', '--no-clipboard', '--stdout', '--template', 'minimal']);
    expect(code).toBe(0);
    expect(stdoutData).toContain('## System');
    expect(stdoutData).toContain('## Runtimes');
    expect(stdoutData).not.toContain('## Packages');
    expect(stdoutData).not.toContain('## Git');
  });

  it('does not include data property on any section in --json output', async () => {
    const code = await runCli(['node', 'crashpack', '--no-clipboard', '--json', '--only', 'runtimes,packages']);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdoutData);
    expect(parsed.sections).toBeDefined();
    for (const sec of parsed.sections) {
      expect(sec).not.toHaveProperty('data');
    }
  });

  it('disables heuristics with --no-heuristics', async () => {
    const code = await runCli(['node', 'crashpack', '--no-clipboard', '--stdout', '--no-heuristics', '--skip', 'git']);
    expect(code).toBe(0);
    expect(stdoutData).not.toContain('## Likely Cause');
  });
});
