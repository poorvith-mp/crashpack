import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runCli } from './cli.js';
import { loadConfig } from './config.js';
import { createCrashPack } from './index.js';
import { execa } from 'execa';
import clipboardy from 'clipboardy';

const question = vi.hoisted(() => vi.fn());
vi.mock('node:readline/promises', () => ({ createInterface: () => ({ question, close: vi.fn() }) }));
vi.mock('./config.js', () => ({ loadConfig: vi.fn(() => null) }));
vi.mock('./index.js', () => ({ createCrashPack: vi.fn(), ALL_COLLECTORS: [{ id: 'git' }, { id: 'system' }] }));
vi.mock('clipboardy', () => ({ default: { write: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('execa', () => ({ execa: vi.fn() }));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, writeFileSync: vi.fn(actual.writeFileSync) };
});

let dir: string;
let stdout: string;
let stderr: string;
const args = (...flags: string[]) => ['node', 'test', ...flags];
const stdinTty = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
const stdoutTty = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
const stderrTty = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY');
const pack = () => ({ projectName: 'demo', generatedAt: 'today', durationMs: 1, redactionCount: 0, sections: [{ id: 'git', title: 'Git', status: 'ok' as const, content: 'Remote: `https://github.com/example/demo.git`' as never, durationMs: 1 }] });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.writeFileSync).mockReset();
  vi.mocked(loadConfig).mockReturnValue(null);
  vi.mocked(createCrashPack).mockResolvedValue(pack());
  vi.mocked(execa).mockResolvedValue({ stdout: 'https://github.com/example/demo/issues/1', exitCode: 0 } as never);
  question.mockReset().mockResolvedValueOnce('Synthetic test title').mockResolvedValueOnce('yes');
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crashpack-behavior-'));
  stdout = ''; stderr = '';
  vi.spyOn(process, 'cwd').mockReturnValue(dir);
  vi.spyOn(process.stdout, 'write').mockImplementation((value) => { stdout += String(value); return true; });
  vi.spyOn(process.stderr, 'write').mockImplementation((value) => { stderr += String(value); return true; });
  vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('unexpected process exit'); });
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
  Object.defineProperty(process.stderr, 'isTTY', { configurable: true, value: true });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  if (stdinTty) Object.defineProperty(process.stdin, 'isTTY', stdinTty);
  else Reflect.deleteProperty(process.stdin, 'isTTY');
  if (stdoutTty) Object.defineProperty(process.stdout, 'isTTY', stdoutTty);
  else Reflect.deleteProperty(process.stdout, 'isTTY');
  if (stderrTty) Object.defineProperty(process.stderr, 'isTTY', stderrTty);
  else Reflect.deleteProperty(process.stderr, 'isTTY');
  fs.rmSync(dir, { recursive: true, force: true });
});

it('rejects config before collecting or starting a child', async () => {
  vi.mocked(loadConfig).mockImplementation(() => { throw new Error('Invalid crashpack configuration'); });
  expect(await runCli(args('--wrap', 'exit 3'))).toBe(2);
  expect(createCrashPack).not.toHaveBeenCalled();
  expect(execa).not.toHaveBeenCalled();
});
it.each([['--lines', '1.5'], ['--redact-extra', '[']])('validates %s before wrapped execution', async (...flags) => {
  expect(await runCli(args('--wrap', 'exit 3', ...flags))).toBe(2);
  expect(createCrashPack).not.toHaveBeenCalled();
  expect(execa).not.toHaveBeenCalled();
});
it('honors configured fields and explicit clipboard/output overrides', async () => {
  vi.mocked(loadConfig).mockReturnValue({ clipboard: false, out: 'configured.md', lines: 50, only: ['git'] });
  await runCli(args());
  expect(clipboardy.write).not.toHaveBeenCalled();
  expect(fs.existsSync(path.join(dir, 'configured.md'))).toBe(true);
  expect(createCrashPack).toHaveBeenCalledWith(expect.objectContaining({ lines: 50, only: ['git'] }));
  await runCli(args('--clipboard', '--out', 'explicit.md', '--lines', '200', '--only', 'system'));
  expect(clipboardy.write).toHaveBeenCalledOnce();
  expect(fs.existsSync(path.join(dir, 'explicit.md'))).toBe(true);
  expect(createCrashPack).toHaveBeenLastCalledWith(expect.objectContaining({ lines: 200, only: ['system'] }));
  expect(stderr).not.toContain(dir);
});
it('requires --issue for --create', async () => {
  expect(await runCli(args('--create'))).toBe(2);
  expect(createCrashPack).not.toHaveBeenCalled();
});
it('never invokes gh for URL-only issue mode', async () => {
  await runCli(args('--issue', '--stdout'));
  expect(execa).not.toHaveBeenCalled();
  expect(stderr).toContain('issues/new');
});
it.each(['--stdout', '--json'])('keeps %s machine-readable and does not upload', async (flag) => {
  await runCli(args('--issue', '--create', flag, '--out', 'local.md'));
  expect(execa).not.toHaveBeenCalled();
  expect(question).not.toHaveBeenCalled();
  if (flag === '--json') expect(JSON.parse(stdout).projectName).toBe('demo');
  else expect(stdout).toMatch(/^# crashpack/);
  expect(fs.readFileSync(path.join(dir, 'local.md'), 'utf8')).toContain('# crashpack');
});
it('never uploads in a noninteractive run', async () => {
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false });
  await runCli(args('--issue', '--create', '--out', 'local.md'));
  expect(execa).not.toHaveBeenCalled();
  expect(question).not.toHaveBeenCalled();
  expect(fs.existsSync(path.join(dir, 'local.md'))).toBe(true);
});
it('keeps the report when confirmation is declined', async () => {
  question.mockReset().mockResolvedValueOnce('A title').mockResolvedValueOnce('no');
  await runCli(args('--issue', '--create', '--out', 'local.md'));
  expect(vi.mocked(execa).mock.calls.some((call) => (call[1] as string[]).includes('create'))).toBe(false);
  expect(fs.existsSync(path.join(dir, 'local.md'))).toBe(true);
});
it.each([0, 1])('handles unavailable gh/auth failure at step %s without tool stderr', async (step) => {
  vi.mocked(execa).mockReset();
  if (step) vi.mocked(execa).mockResolvedValueOnce({ exitCode: 0 } as never);
  vi.mocked(execa).mockRejectedValueOnce(new Error('synthetic-private-tool-error'));
  await runCli(args('--issue', '--create', '--out', 'local.md'));
  expect(stderr).not.toContain('synthetic-private-tool-error');
  expect(stderr).toContain('gh');
  expect(fs.existsSync(path.join(dir, 'local.md'))).toBe(true);
});
it('saves large reports intact without attempting upload', async () => {
  const large = pack(); large.sections[0].content = ('a'.repeat(66000)) as never;
  vi.mocked(createCrashPack).mockResolvedValue(large);
  await runCli(args('--issue', '--create', '--out', 'local.md'));
  expect(execa).not.toHaveBeenCalled();
  expect(fs.readFileSync(path.join(dir, 'local.md'), 'utf8')).toContain('a'.repeat(66000));
  expect(stderr).toContain('too large');
});
it('uploads only after review/title/confirmation using an argument array and intact body file', async () => {
  await runCli(args('--issue', '--create', '--out', 'local.md'));
  expect(stderr).toContain('Review');
  expect(question).toHaveBeenCalledTimes(2);
  expect(execa).toHaveBeenLastCalledWith('gh', ['issue', 'create', '--repo', 'example/demo', '--title', 'Synthetic test title', '--body-file', path.join(dir, 'local.md')], expect.objectContaining({ shell: false, env: expect.objectContaining({ GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1' }) }));
});

it('honors no-clipboard and replaces configured skip/redaction fields', async () => {
  vi.mocked(loadConfig).mockReturnValue({ clipboard: true, skip: ['git'], redactExtra: ['configured'] });
  await runCli(args('--no-clipboard', '--skip', 'system', '--redact-extra', 'explicit'));
  expect(clipboardy.write).not.toHaveBeenCalled();
  expect(createCrashPack).toHaveBeenCalledWith(expect.objectContaining({ skip: ['system'], redactExtra: [/explicit/g] }));
});

it('applies configured render sections without filtering collection or JSON', async () => {
  vi.mocked(loadConfig).mockReturnValue({ sections: [] });
  await runCli(args('--stdout'));
  expect(stdout).not.toContain('## Git');
  expect(createCrashPack).toHaveBeenCalledWith(expect.objectContaining({ only: undefined, skip: undefined }));
  stdout = '';
  await runCli(args('--json'));
  expect(JSON.parse(stdout).sections).toHaveLength(1);
});

describe('requested report backups and save failures', () => {
  it.each(['--stdout', '--json'])('saves a Markdown backup in %s mode without issue creation', async (flag) => {
    expect(await runCli(args(flag, '--no-clipboard', '--out', 'backup.md'))).toBe(0);
    const saved = fs.readFileSync(path.join(dir, 'backup.md'), 'utf8');
    expect(saved).toMatch(/^# crashpack/);
    if (flag === '--json') expect(JSON.parse(stdout).projectName).toBe('demo');
    else expect(stdout).toBe(saved + '\n');
    expect(clipboardy.write).not.toHaveBeenCalled();
  });

  it('honors configured Markdown backup in JSON mode', async () => {
    vi.mocked(loadConfig).mockReturnValue({ out: 'configured.md' });
    expect(await runCli(args('--json'))).toBe(0);
    expect(fs.readFileSync(path.join(dir, 'configured.md'), 'utf8')).toMatch(/^# crashpack/);
    expect(JSON.parse(stdout).projectName).toBe('demo');
  });

  it.each(['--stdout', '--json', '--no-clipboard'])('returns failure with usable output when a requested %s backup cannot be saved', async (flag) => {
    expect(await runCli(args(flag, '--out', 'missing/backup.md'))).toBe(1);
    expect(stderr).toMatch(/could not save/i);
    expect(stderr).not.toContain(dir);
    expect(stderr).not.toContain('REPORT SAVED');
    expect(stdout + stderr).not.toContain('https://razorpay.me/@poorvithmp');
    if (flag === '--json') expect(JSON.parse(stdout).projectName).toBe('demo');
    else expect(stdout).toMatch(/^# crashpack/);
  });

  it('returns failure for a configured destination and never uploads', async () => {
    vi.mocked(loadConfig).mockReturnValue({ out: 'missing/configured.md' });
    expect(await runCli(args('--issue', '--create', '--no-clipboard'))).toBe(1);
    expect(execa).not.toHaveBeenCalled();
    expect(question).not.toHaveBeenCalled();
    expect(stderr).toMatch(/could not save/i);
    expect(stdout).toMatch(/^# crashpack/);
  });

  it('preserves the failed wrapped child exit code when backup saving fails', async () => {
    vi.mocked(execa).mockResolvedValueOnce({ exitCode: 7 } as never);
    expect(await runCli(args('--wrap', 'synthetic-command', '--json', '--out', 'missing/backup.md'))).toBe(7);
    expect(JSON.parse(stdout).projectName).toBe('demo');
    expect(stderr).toMatch(/could not save/i);
  });

  it('warns but preserves success and Markdown recovery when the implicit temporary save fails', async () => {
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw new Error('synthetic-private-error'); });
    expect(await runCli(args('--no-clipboard'))).toBe(0);
    expect(stdout).toMatch(/^# crashpack/);
    expect(stderr).toMatch(/could not save/i);
    expect(stderr).not.toContain('synthetic-private-error');
    expect(stderr).not.toContain('REPORT SAVED');
  });

  it('writes a requested issue body only once when review leaves it unchanged', async () => {
    const write = vi.spyOn(fs, 'writeFileSync');
    expect(await runCli(args('--issue', '--create', '--no-clipboard', '--out', 'local.md'))).toBe(0);
    expect(write).toHaveBeenCalledTimes(1);
    expect(vi.mocked(execa).mock.calls.some(call => (call[1] as string[]).includes('create'))).toBe(true);
  });

  it('restores the exact reviewed issue body if its local file changed during confirmation', async () => {
    question.mockReset().mockResolvedValueOnce('Synthetic title').mockImplementationOnce(() => {
      fs.writeFileSync(path.join(dir, 'local.md'), 'synthetic changed content');
      return Promise.resolve('yes');
    });
    expect(await runCli(args('--issue', '--create', '--out', 'local.md'))).toBe(0);
    expect(fs.readFileSync(path.join(dir, 'local.md'), 'utf8')).toMatch(/^# crashpack/);
  });
});

it('keeps a complete report on a gh creation failure without leaking tool stderr', async () => {
  vi.mocked(execa).mockResolvedValueOnce({ exitCode: 0 } as never).mockResolvedValueOnce({ exitCode: 0 } as never).mockRejectedValueOnce(new Error('synthetic-private-error'));
  await runCli(args('--issue', '--create', '--out', 'local.md'));
  expect(stderr).toContain('Check the repository before retrying');
  expect(stderr).not.toContain('synthetic-private-error');
  expect(fs.readFileSync(path.join(dir, 'local.md'), 'utf8')).toContain('# crashpack');
});

describe('optional sponsorship after interactive report output', () => {
  const sponsorUrl = 'https://razorpay.me/@poorvithmp';

  beforeEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    vi.stubEnv('CI', '');
    vi.stubEnv('GITHUB_ACTIONS', '');
  });

  it('shows one voluntary link on stderr after saving, never in the report', async () => {
    expect(await runCli(args('--no-clipboard', '--out', 'local.md'))).toBe(0);
    expect(stderr.split(sponsorUrl)).toHaveLength(2);
    expect(stderr).toContain('optional');
    expect(stderr.indexOf(sponsorUrl)).toBeGreaterThan(stderr.indexOf('REPORT SAVED'));
    expect(stdout).not.toContain(sponsorUrl);
    expect(fs.readFileSync(path.join(dir, 'local.md'), 'utf8')).not.toContain(sponsorUrl);
  });

  it.each(['stdin', 'stdout', 'stderr'] as const)('stays silent when %s is redirected', async (stream) => {
    Object.defineProperty(process[stream], 'isTTY', { configurable: true, value: false });
    expect(await runCli(args('--no-clipboard', '--out', 'local.md'))).toBe(0);
    expect(stdout + stderr).not.toContain(sponsorUrl);
  });

  it.each(['--stdout', '--json', '--stdin'])('stays silent in %s mode even with terminal streams', async (flag) => {
    expect(await runCli(args(flag, '--no-clipboard', '--out', 'local.md'))).toBe(0);
    expect(stdout + stderr).not.toContain(sponsorUrl);
    if (flag === '--json') expect(JSON.parse(stdout).projectName).toBe('demo');
  });

  it.each(['CI', 'GITHUB_ACTIONS'])('stays silent when %s identifies automation', async (name) => {
    vi.stubEnv(name, 'true');
    expect(await runCli(args('--no-clipboard', '--out', 'local.md'))).toBe(0);
    expect(stdout + stderr).not.toContain(sponsorUrl);
  });

  it('stays silent when the requested report cannot be saved', async () => {
    await runCli(args('--no-clipboard', '--out', 'missing/local.md'));
    expect(stdout).toContain('# crashpack');
    expect(stdout + stderr).not.toContain(sponsorUrl);
  });

  it('stays silent on validation failure', async () => {
    expect(await runCli(args('--lines', '0'))).toBe(2);
    expect(stdout + stderr).not.toContain(sponsorUrl);
  });

  it('keeps issue creation free of sponsorship even after confirmation', async () => {
    await runCli(args('--issue', '--create', '--no-clipboard', '--out', 'local.md'));
    expect(stdout + stderr).not.toContain(sponsorUrl);
  });

  it.each([0, 7])('stays silent for a wrapped command with exit %s', async (exitCode) => {
    vi.mocked(execa).mockResolvedValueOnce({ exitCode } as never);
    expect(await runCli(args('--wrap', 'synthetic-command', '--no-clipboard', '--out', 'local.md'))).toBe(exitCode);
    expect(stdout + stderr).not.toContain(sponsorUrl);
    if (exitCode !== 0) expect(fs.readFileSync(path.join(dir, 'local.md'), 'utf8')).toContain('# crashpack');
  });
});
