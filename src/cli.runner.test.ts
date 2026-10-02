import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCli, extractIssueUrl, parseRegexPattern, issueBodyFor, resolveLines } from './cli.js';

vi.mock('clipboardy', () => ({
  default: { write: vi.fn().mockResolvedValue(undefined) },
}));

let out: string[];
let err: string[];
let outSpy: { mockRestore: () => void };
let errSpy: { mockRestore: () => void };

beforeEach(() => {
  out = [];
  err = [];
  outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: any) => { out.push(String(c)); return true; });
  errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: any) => { err.push(String(c)); return true; });
});

afterEach(() => {
  outSpy.mockRestore();
  errSpy.mockRestore();
});

const argv = (...flags: string[]) => ['node', 'cli.js', ...flags];

describe('runCli output channels (B-10)', () => {
  it('--stdout puts markdown on stdout and nothing on stderr', async () => {
    const code = await runCli(argv('--stdout', '--only', 'system'));

    expect(code).toBe(0);
    expect(out.join('')).toContain('# crashpack ·');
    expect(err.join('')).toBe('');
  });

  it('--json emits a parseable CrashPack', async () => {
    await runCli(argv('--json', '--only', 'system'));

    const pack = JSON.parse(out.join(''));
    expect(pack.sections).toHaveLength(1);
    expect(pack.sections[0].id).toBe('system');
  });

  it('--only limits the collector set', async () => {
    await runCli(argv('--json', '--only', 'git'));
    expect(JSON.parse(out.join('')).sections).toHaveLength(1);
  });
});

describe('runCli input validation (B-12)', () => {
  it('warns on an unknown collector id instead of silently emitting nothing', async () => {
    await runCli(argv('--json', '--only', 'nonsense'));

    expect(err.join('')).toContain('unknown collector');
    expect(err.join('')).not.toContain('nonsense');
  });

  it('warns on an invalid --redact-extra pattern rather than dropping it silently', async () => {
    await runCli(argv('--json', '--only', 'system', '--redact-extra', '['));

    expect(err.join('')).toContain('invalid pattern');
  });
});

describe('runCli exit codes (R8.3)', () => {
  it('propagates a wrapped command failure', async () => {
    // This checks the child exit contract, not optional runtime probe latency.
    expect(await runCli(argv('--wrap', 'exit 3', '--stdout', '--only', 'logs'))).toBe(3);
  });

  it('returns 0 and produces no report when the wrapped command succeeds', async () => {
    const code = await runCli(argv('--wrap', 'exit 0', '--stdout', '--only', 'logs'));

    expect(code).toBe(0);
    expect(out.join('')).not.toContain('# crashpack ·');
  });
});

describe('extractIssueUrl (B-06)', () => {
  it('builds a GitHub URL from an https remote', () => {
    const res = extractIssueUrl('https://github.com/poorvith-mp/crashpack', 'crashpack', 'body');
    expect(res?.platform).toBe('GitHub');
    expect(res?.url).toContain('github.com/poorvith-mp/crashpack/issues/new');
  });

  it('builds a GitHub URL from an ssh remote', () => {
    expect(extractIssueUrl('git@github.com:poorvith-mp/crashpack.git', 'crashpack', '')?.platform).toBe('GitHub');
  });

  it('builds a GitLab URL', () => {
    const res = extractIssueUrl('https://gitlab.com/group/proj.git', 'proj', '');
    expect(res?.platform).toBe('GitLab');
    expect(res?.url).toContain('/-/issues/new');
  });

  it('returns null for unsupported hosts', () => {
    expect(extractIssueUrl('https://bitbucket.org/team/repo.git', 'repo', '')).toBeNull();
    expect(extractIssueUrl('https://git.internal.example.com/team/repo.git', 'repo', '')).toBeNull();
    expect(extractIssueUrl(undefined, 'repo', '')).toBeNull();
  });
});

describe('issueBodyFor (B-06)', () => {
  it('passes a small report through unchanged', () => {
    const { body, truncated } = issueBodyFor('# small report');
    expect(truncated).toBe(false);
    expect(body).toBe('# small report');
  });

  it('falls back to a short body when the encoded report is too large', () => {
    const huge = '`code` and *markdown* '.repeat(1000);
    const { body, truncated } = issueBodyFor(huge, '/tmp/report.md');

    expect(truncated).toBe(true);
    expect(encodeURIComponent(body).length).toBeLessThan(6000);
    expect(body).toContain('saved report');
    expect(body).not.toContain('/tmp/report.md');
    expect(body).not.toContain('clipboard');
  });
});

describe('parseRegexPattern', () => {
  it('accepts a bare pattern body', () => {
    expect(parseRegexPattern('acme-\\d+')?.source).toBe('acme-\\d+');
  });

  it('accepts /body/flags and forces the global flag', () => {
    const re = parseRegexPattern('/secret/i');
    expect(re?.flags).toContain('g');
    expect(re?.flags).toContain('i');
  });

  it('returns null for an invalid pattern', () => {
    expect(parseRegexPattern('[')).toBeNull();
  });
});

describe('resolveLines precedence (B-08)', () => {
  it('an explicit --lines 200 beats a config file setting 500', () => {
    // The bug: comparing against the literal '200' made this indistinguishable
    // from the flag being absent, so config silently won.
    expect(resolveLines('200', 500)).toBe(200);
  });

  it('config applies when the flag is absent', () => {
    expect(resolveLines(undefined, 500)).toBe(500);
  });

  it('falls back to 200 when neither is set', () => {
    expect(resolveLines(undefined, undefined)).toBe(200);
  });

  it('an explicit flag beats config for any value', () => {
    expect(resolveLines('50', 500)).toBe(50);
  });

  it.each(['abc', '0', '-1', '1.5', '20oops', '9007199254740992'])('rejects invalid lines %s', (value) => {
    expect(() => resolveLines(value)).toThrow('positive safe integer');
  });
});

it.each(['https://evilgithub.com/team/repo', 'https://github.com.evil.test/team/repo', 'https://evil.test/github.com/team/repo', 'https://github.com@evil.test/team/repo'])('rejects spoofed remotes %s', (remote) => {
  expect(extractIssueUrl(remote)).toBeNull();
});
