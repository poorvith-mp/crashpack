import { Command } from 'commander';
import pc from 'picocolors';
import clipboardy from 'clipboardy';
import { execa } from 'execa';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createCrashPack, ALL_COLLECTORS } from './index.js';
import { renderMarkdown } from './render/markdown.js';
import { loadConfig, configFileFound } from './config.js';

interface CliArgs {
  wrap?: string;
  stdin?: boolean;
  out?: string;
  stdout?: boolean;
  json?: boolean;
  clipboard?: boolean;
  lines?: string;
  since?: string;
  issue?: boolean;
  only?: string;
  skip?: string;
  redactExtra?: string[];
  entropy?: boolean;
}

/**
 * Injected by tsup from package.json (B-15). The fallback keeps `tsx src/cli.ts`
 * and the test suite working, where no define pass has run.
 */
declare const __CRASHPACK_VERSION__: string | undefined;
const VERSION = typeof __CRASHPACK_VERSION__ === 'string' ? __CRASHPACK_VERSION__ : '0.0.0-dev';

function warn(message: string): void {
  process.stderr.write(`${pc.yellow('warning:')} ${message}\n`);
}

const STDIN_TIMEOUT_MS = 10_000;

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    // A pipe that never closes must not hang crashpack forever (B-12)
    const timer = setTimeout(() => {
      warn('stdin did not close within 10s; proceeding with what arrived');
      resolve(data);
    }, STDIN_TIMEOUT_MS);
    timer.unref?.();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(data);
    });
    process.stdin.on('error', () => {
      clearTimeout(timer);
      resolve(data);
    });
    // If stdin is a TTY and not piped, don't hang
    if (process.stdin.isTTY) {
      clearTimeout(timer);
      resolve('');
    }
  });
}

export function parseRegexPattern(pattern: string): RegExp | null {
  try {
    if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
      const lastSlash = pattern.lastIndexOf('/');
      const body = pattern.slice(1, lastSlash);
      const flags = pattern.slice(lastSlash + 1) || 'g';
      // nosemgrep: detect-non-literal-regexp, javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
      return new RegExp(body, flags.includes('g') ? flags : flags + 'g');
    }
    // nosemgrep: detect-non-literal-regexp, javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
    return new RegExp(pattern, 'g');
  } catch {
    return null;
  }
}

/**
 * GitHub rejects very long URLs, and percent-encoding roughly doubles
 * markdown. A truncated issue the user does not know is truncated is the bad
 * outcome, so past the ceiling we link to the saved file instead (B-06).
 */
const MAX_ISSUE_URL = 6000;

/**
 * An explicit --lines must beat a config file (B-08). Commander no longer
 * supplies a default, so `undefined` is the only signal that the flag was
 * absent — comparing against the literal '200' made an explicit --lines 200
 * indistinguishable from no flag at all.
 */
export function resolveLines(cliLines?: string, configLines?: number): number {
  const raw = cliLines ?? (configLines !== undefined ? String(configLines) : undefined);
  return parseInt(raw ?? '200', 10) || 200;
}

export function issueBodyFor(markdown: string, savedPath?: string): { body: string; truncated: boolean } {
  if (encodeURIComponent(markdown).length <= MAX_ISSUE_URL) {
    return { body: markdown, truncated: false };
  }
  const where = savedPath ? `\n\nFull report saved to: ${savedPath}` : '';
  return {
    body: `The full crashpack report was too large for a pre-filled URL.\n\nIt is on your clipboard — paste it here.${where}`,
    truncated: true,
  };
}

export function extractIssueUrl(remoteUrl?: string, projectName?: string, body?: string): { platform: 'GitHub' | 'GitLab'; url: string } | null {
  if (!remoteUrl) return null;
  const ghMatch = remoteUrl.match(/github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git|\/|$)/);
  if (ghMatch && ghMatch[1] && ghMatch[2]) {
    const repo = `${ghMatch[1]}/${ghMatch[2]}`;
    return {
      platform: 'GitHub',
      url: `https://github.com/${repo}/issues/new?title=${encodeURIComponent(`[Bug]: Crash in ${projectName || 'repo'}`)}&body=${encodeURIComponent(body || '')}`,
    };
  }
  const glMatch = remoteUrl.match(/gitlab\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git|\/|$)/);
  if (glMatch && glMatch[1] && glMatch[2]) {
    const repo = `${glMatch[1]}/${glMatch[2]}`;
    return {
      platform: 'GitLab',
      url: `https://gitlab.com/${repo}/-/issues/new?issue[title]=${encodeURIComponent(`[Bug]: Crash in ${projectName || 'repo'}`)}&issue[description]=${encodeURIComponent(body || '')}`,
    };
  }
  return null;
}

export async function runCli(argv = process.argv): Promise<number> {
  const program = new Command();

  program
    .name('crashpack')
    .description('Everything your bug report needs, in one command.')
    .version(VERSION)
    .option('--wrap <command>', 'Run a command, stream live, and capture crash context on non-zero exit')
    .option('--stdin', 'Read piped input as the log section')
    .option('--out <path>', 'Write output to a specific file instead of temp')
    .option('--stdout', 'Print the markdown report to stdout')
    .option('--json', 'Emit the raw CrashPack JSON object')
    .option('--no-clipboard', 'Skip copying to clipboard')
    // No commander default: absent must be distinguishable from an explicit
    // --lines 200, or config silently overrides the user's own flag (B-08).
    .option('--lines <n>', 'Number of log lines to capture (default 200)')
    .option('--since <duration>', 'Filter git commits since duration (e.g. 1h, 1d)')
    .option('--issue', 'Generate GitHub or GitLab issue pre-fill URL for this repository')
    .option('--only <ids>', 'Comma-separated collector IDs to run')
    .option('--skip <ids>', 'Comma-separated collector IDs to skip')
    .option('--redact-extra <pattern...>', 'Additional regex pattern(s) to redact')
    .option('--no-entropy', 'Disable the generic high-entropy token fallback');

  program.parse(argv);
  const options = program.opts<CliArgs>();

  // Merge defaults from .crashpackrc if present
  let configLines: number | undefined;
  const fileConfig = loadConfig();
  if (fileConfig) {
    if (!options.only && fileConfig.only) options.only = fileConfig.only.join(',');
    if (!options.skip && fileConfig.skip) options.skip = fileConfig.skip.join(',');
    if ((!options.redactExtra || options.redactExtra.length === 0) && fileConfig.redactExtra) {
      options.redactExtra = fileConfig.redactExtra;
    }
    configLines = fileConfig.lines;
  } else if (configFileFound()) {
    warn('config file could not be parsed; using CLI options only');
  }

  // Validate collector IDs rather than silently producing an empty report
  const validIds = new Set(ALL_COLLECTORS.map((c) => c.id));
  for (const flag of ['only', 'skip'] as const) {
    const raw = options[flag];
    if (!raw) continue;
    const unknown = raw.split(',').map((s) => s.trim()).filter((s) => s && !validIds.has(s.toLowerCase()));
    if (unknown.length > 0) {
      warn(`--${flag}: unknown collector ${unknown.join(', ')} (valid: ${[...validIds].join(', ')})`);
    }
  }

  // 1. Handle --wrap mode
  if (options.wrap) {
    const lineLimit = resolveLines(options.lines, configLines);
    const logBuffer: string[] = [];

    const handleChunk = (chunk: Buffer | string) => {
      const str = chunk.toString();
      // Stream live to user's terminal
      process.stderr.write(str);
      // Keep in circular buffer
      const newLines = str.split(/\r?\n/);
      for (const line of newLines) {
        logBuffer.push(line);
        if (logBuffer.length > lineLimit * 2) {
          logBuffer.splice(0, logBuffer.length - lineLimit);
        }
      }
    };

    try {
      // Execute command through shell so piping/arguments work naturally
      const subprocess = execa(options.wrap, {
        shell: true,
        reject: false,
        all: true,
      });

      if (subprocess.all) {
        subprocess.all.on('data', handleChunk);
      }

      const result = await subprocess;

      // If command exited successfully (code 0), produce nothing extra and pass exit 0
      if (result.exitCode === 0) {
        return 0;
      }

      // Non-zero exit -> proceed to collect pack
      const wrapBuffer = logBuffer.slice(-lineLimit).join('\n');
      return await generateAndOutput({ ...options, lines: String(lineLimit) }, { wrapBuffer, exitCode: result.exitCode });
    } catch (err: any) {
      process.stderr.write(`\n${pc.red('Error running wrapped command:')} ${err.message}\n`);
      return 1;
    }
  }

  // 2. Handle --stdin mode
  let stdinLog: string | undefined;
  if (options.stdin) {
    stdinLog = await readStdin();
  }

  return await generateAndOutput({ ...options, lines: String(resolveLines(options.lines, configLines)) }, { stdinLog });
}

interface ExtraContext {
  wrapBuffer?: string;
  stdinLog?: string;
  exitCode?: number;
}

async function generateAndOutput(options: CliArgs, extra: ExtraContext): Promise<number> {
  const lineLimit = resolveLines(options.lines);
  const onlyList = options.only ? options.only.split(',').map((s) => s.trim()) : undefined;
  const skipList = options.skip ? options.skip.split(',').map((s) => s.trim()) : undefined;

  const extraPatterns: RegExp[] = [];
  if (options.redactExtra) {
    for (const pat of options.redactExtra) {
      const parsed = parseRegexPattern(pat);
      if (parsed) extraPatterns.push(parsed);
      // Silently dropping this leaves the user believing a pattern protects
      // them when it does not (B-12)
      else warn(`--redact-extra: ignoring invalid pattern ${JSON.stringify(pat)}`);
    }
  }

  const isSilentMode = Boolean(options.stdout || options.json);

  if (!isSilentMode) {
    process.stderr.write(`\n${pc.cyan('╭──────────────────────────────────────────────────────────╮')}\n`);
    process.stderr.write(`${pc.cyan('│')}  ${pc.bold(pc.yellow('⚡ crashpack'))} ${pc.dim(`v${VERSION}`)}                                    ${pc.cyan('│')}\n`);
    process.stderr.write(`${pc.cyan('│')}  ${pc.dim('Zero-config crash context collector')}                     ${pc.cyan('│')}\n`);
    process.stderr.write(`${pc.cyan('│')}  ${pc.magenta('Built by Poorvith')} ${pc.dim('(@poorvith-mp)')}                      ${pc.cyan('│')}\n`);
    process.stderr.write(`${pc.cyan('╰──────────────────────────────────────────────────────────╯')}\n\n`);
    process.stderr.write(`  ${pc.yellow('●')} ${pc.dim('Scanning debug context across subsystems…')}\n\n`);
  }

  const collectorStatuses: Record<string, { status: string; reason?: string }> = {};

  const pack = await createCrashPack({
    cwd: process.cwd(),
    lines: lineLimit,
    since: options.since,
    stdinLog: extra.stdinLog,
    wrapBuffer: extra.wrapBuffer,
    only: onlyList,
    skip: skipList,
    redactExtra: extraPatterns,
    entropy: options.entropy,
    onCollectorComplete: (id, status, reason) => {
      collectorStatuses[id] = { status, reason };
    },
  });

  if (!isSilentMode) {
    // Print collection status summary
    const statusItems: string[] = [];
    for (const section of pack.sections) {
      const paddedId = section.id.padEnd(9);
      if (section.status === 'ok') {
        statusItems.push(`  ${pc.green('✓')} ${pc.bold(paddedId)} ${pc.dim('ready')}`);
      } else {
        const reasonStr = section.unavailableReason ? ` ${pc.dim(`(${section.unavailableReason})`)}` : '';
        statusItems.push(`  ${pc.dim(`- ${paddedId}${reasonStr}`)}`);
      }
    }

    process.stderr.write(statusItems.join('\n') + '\n\n');
  }

  const markdown = renderMarkdown(pack);

  // The issue URL goes to stderr on every output path, so --issue --stdout
  // and --issue --json still produce one (B-08.7).
  const printIssueUrl = (savedPath?: string) => {
    if (!options.issue) return;

    const gitSection = pack.sections.find((s) => s.id === 'git');
    const remoteMatch = (gitSection?.content || '').match(/Remote:\s*`([^`]+)`/);
    const { body, truncated } = issueBodyFor(markdown, savedPath);
    const issueInfo = extractIssueUrl(remoteMatch ? remoteMatch[1] : undefined, pack.projectName, body);

    if (!issueInfo) {
      warn('--issue: no GitHub or GitLab remote detected');
      return;
    }
    if (truncated) {
      warn('report too large for a pre-filled URL; paste the full report from your clipboard');
    }
    process.stderr.write(`  ${pc.bold(`🔗 ${issueInfo.platform} Issue URL:`)}\n  ${pc.underline(pc.cyan(issueInfo.url))}\n\n`);
  };

  // Handle JSON output
  if (options.json) {
    process.stdout.write(JSON.stringify(pack, null, 2) + '\n');
    printIssueUrl();
    return extra.exitCode ?? 0;
  }

  // Handle stdout output
  if (options.stdout) {
    process.stdout.write(markdown + '\n');
    printIssueUrl();
    return extra.exitCode ?? 0;
  }

  // Handle clipboard copy (enabled by default unless --no-clipboard)
  let copiedToClipboard = false;
  if (options.clipboard !== false) {
    try {
      await clipboardy.write(markdown);
      copiedToClipboard = true;
    } catch {
      // Gracefully fall back to file on headless / SSH environments
      copiedToClipboard = false;
    }
  }

  // Determine output file path
  let outputPath = options.out;
  if (!outputPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    outputPath = path.join(os.tmpdir(), `crashpack-${timestamp}.md`);
  }

  try {
    fs.writeFileSync(outputPath, markdown, 'utf8');
  } catch {
    // If filesystem is read-only, fallback to stdout
    process.stdout.write(markdown + '\n');
    return extra.exitCode ?? 0;
  }

  if (!isSilentMode) {
    const clipHeader = copiedToClipboard
      ? `${pc.bold(pc.green('📋 COPIED TO CLIPBOARD!'))} ${pc.dim('Paste directly into GitHub / Slack / AI')}`
      : `${pc.bold(pc.yellow('📄 REPORT SAVED'))} ${pc.dim('(Clipboard unavailable in this environment)')}`;

    const redactNote = pack.redactionCount > 0
      ? `${pc.yellow('🛡️ ')} ${pc.bold(pack.redactionCount.toString())} sensitive value${pack.redactionCount === 1 ? '' : 's'} masked as [redacted]`
      : `${pc.green('🛡️ ')} Zero sensitive leaks detected (diffs & logs verified safe)`;

    process.stderr.write(`${pc.cyan('╭──────────────────────────────────────────────────────────────────────────╮')}\n`);
    process.stderr.write(`${pc.cyan('│')}  ${clipHeader}\n`);
    process.stderr.write(`${pc.cyan('│')}\n`);
    process.stderr.write(`${pc.cyan('│')}  ${redactNote}\n`);
    process.stderr.write(`${pc.cyan('│')}  ${pc.dim('📁 Backup file:')} ${pc.cyan(outputPath)}\n`);
    process.stderr.write(`${pc.cyan('│')}  ${pc.dim('⚡')} ${pc.magenta('Built by Poorvith')} ${pc.dim('· 100% local-first (0 network calls)')}\n`);
    process.stderr.write(`${pc.cyan('╰──────────────────────────────────────────────────────────────────────────╯')}\n\n`);

  }

  printIssueUrl(outputPath);

  return extra.exitCode ?? 0;
}

// Auto-run if executed directly as script
if (process.argv[1] && (process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('cli.ts'))) {
  runCli().then((code) => {
    process.exit(code);
  });
}
