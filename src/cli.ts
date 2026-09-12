import { Command } from 'commander';
import pc from 'picocolors';
import clipboardy from 'clipboardy';
import { execa } from 'execa';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { createCrashPack, ALL_COLLECTORS } from './index.js';
import { renderMarkdown, renderReport } from './render/markdown.js';
import { loadConfig } from './config.js';

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
  create?: boolean;
  only?: string;
  skip?: string;
  redactExtra?: string[];
  entropy?: boolean;
  template?: string;
  sourcemaps?: boolean;
  heuristics?: boolean;
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
  const value = Number(raw ?? '200');
  if ((raw !== undefined && !/^\d+$/.test(raw)) || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error('--lines must be a positive safe integer');
  }
  return value;
}

export function issueBodyFor(markdown: string, savedPath?: string): { body: string; truncated: boolean } {
  if (encodeURIComponent(markdown).length <= MAX_ISSUE_URL) {
    return { body: markdown, truncated: false };
  }
  return {
    body: `The full crashpack report was too large for a pre-filled URL. Review and paste the full ${savedPath ? 'saved report' : 'report from your local output'} here.`,
    truncated: true,
  };
}

export function extractIssueUrl(
  remoteUrl?: string,
  projectName?: string,
  body?: string,
  issueTitlePrefix?: string
): { platform: 'GitHub' | 'GitLab'; url: string } | null {
  if (!remoteUrl) return null;
  const ghMatch = remoteUrl.match(/^(?:https:\/\/github\.com\/|github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  if (ghMatch && ghMatch[1] && ghMatch[2]) {
    const repo = `${ghMatch[1]}/${ghMatch[2]}`;
    const defaultTitle = `[Bug]: Crash in ${projectName || 'repo'}`;
    const title = issueTitlePrefix ? `${issueTitlePrefix}Crash in ${projectName || 'repo'}` : defaultTitle;
    return {
      platform: 'GitHub',
      url: `https://github.com/${repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body || '')}`,
    };
  }
  const glMatch = remoteUrl.match(/^(?:https:\/\/gitlab\.com\/|gitlab\.com\/|git@gitlab\.com:|ssh:\/\/git@gitlab\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  if (glMatch && glMatch[1] && glMatch[2]) {
    const repo = `${glMatch[1]}/${glMatch[2]}`;
    const defaultTitle = `[Bug]: Crash in ${projectName || 'repo'}`;
    const title = issueTitlePrefix ? `${issueTitlePrefix}Crash in ${projectName || 'repo'}` : defaultTitle;
    return {
      platform: 'GitLab',
      url: `https://gitlab.com/${repo}/-/issues/new?issue[title]=${encodeURIComponent(title)}&issue[description]=${encodeURIComponent(body || '')}`,
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
    .option('--clipboard', 'Copy report to clipboard (overrides config)')
    .option('--no-clipboard', 'Skip copying to clipboard')
    .option('--template <name>', 'Template to render (default, envinfo, minimal)')
    // No commander default: absent must be distinguishable from an explicit
    // --lines 200, or config silently overrides the user's own flag (B-08).
    .option('--lines <n>', 'Number of log lines to capture (default 200)')
    .option('--since <duration>', 'Filter git commits since duration (e.g. 1h, 1d)')
    .option('--issue', 'Generate GitHub or GitLab issue pre-fill URL for this repository')
    .option('--create', 'With --issue, review and confirm creating a GitHub issue using gh')
    .option('--only <ids>', 'Comma-separated collector IDs to run')
    .option('--skip <ids>', 'Comma-separated collector IDs to skip')
    .option('--redact-extra <pattern...>', 'Additional regex pattern(s) to redact')
    .option('--no-entropy', 'Disable the generic high-entropy token fallback')
    .option('--no-sourcemaps', 'Disable sourcemap stack trace resolution')
    .option('--no-heuristics', 'Disable version-mismatch heuristics');

  const helpGroups: Record<string, string[]> = {
    Input: ['wrap', 'stdin'],
    Output: ['out', 'stdout', 'json', 'clipboard', 'no-clipboard', 'template'],
    Collection: ['only', 'skip', 'lines', 'since', 'redact-extra', 'no-entropy'],
    Analysis: ['no-sourcemaps', 'no-heuristics'],
    Issue: ['issue', 'create'],
  };

  program.configureHelp({
    formatHelp: (cmd, helper) => {
      let output = `${cmd.description()}\n\nUsage: ${helper.commandUsage(cmd)}\n\n`;
      output += `Options:\n  -V, --version                  output the version number\n  -h, --help                     display help for command\n\n`;

      const opts = cmd.options;
      const getOpt = (name: string) =>
        opts.find((o) => o.name() === name || o.attributeName() === name || o.long === `--${name}`);

      for (const [groupName, optNames] of Object.entries(helpGroups)) {
        output += `${groupName}:\n`;
        for (const optName of optNames) {
          const opt = getOpt(optName);
          if (opt) {
            const flags = opt.flags.padEnd(30);
            output += `  ${flags} ${opt.description}\n`;
          }
        }
        output += '\n';
      }
      return output.trimEnd() + '\n';
    },
  });

  program.parse(argv);
  const options = program.opts<CliArgs>();

  // Merge defaults from .crashpackrc if present
  let fileConfig: ReturnType<typeof loadConfig> = null;
  try {
    fileConfig = loadConfig();
    if (fileConfig) {
      if (options.only === undefined && fileConfig.only) options.only = fileConfig.only.join(',');
      if (options.skip === undefined && fileConfig.skip) options.skip = fileConfig.skip.join(',');
      options.redactExtra ??= fileConfig.redactExtra;
      options.out ??= fileConfig.out;
      if (program.getOptionValueSource('clipboard') !== 'cli') options.clipboard = fileConfig.clipboard;
      options.template ??= fileConfig.template;
      if (program.getOptionValueSource('sourcemaps') !== 'cli' && fileConfig.sourcemaps !== undefined) {
        options.sourcemaps = fileConfig.sourcemaps;
      }
      if (program.getOptionValueSource('heuristics') !== 'cli' && fileConfig.heuristics !== undefined) {
        options.heuristics = fileConfig.heuristics;
      }
    }
    options.lines = String(resolveLines(options.lines, fileConfig?.lines));
    if (options.out !== undefined) {
      if (!options.out.trim()) throw new Error('--out must be a nonempty path');
      options.out = path.resolve(process.cwd(), options.out);
    }
    if (options.template !== undefined) {
      const validTemplates = ['default', 'envinfo', 'minimal'];
      if (!validTemplates.includes(options.template)) {
        throw new Error(`Unknown template "${options.template}". Available: ${validTemplates.join(', ')}.`);
      }
    }
    if (options.redactExtra?.some((pattern) => !parseRegexPattern(pattern))) throw new Error('--redact-extra: invalid pattern; check regex syntax and flags');
    if (options.create && !options.issue) throw new Error('--create requires --issue');
  } catch (error) {
    warn(error instanceof Error ? error.message : 'Invalid crashpack options');
    return 2;
  }

  // Validate collector IDs rather than silently producing an empty report
  const validIds = new Set(ALL_COLLECTORS.map((c) => c.id));
  for (const flag of ['only', 'skip'] as const) {
    const raw = options[flag];
    if (!raw) continue;
    const unknown = raw.split(',').map((s) => s.trim()).filter((s) => s && !validIds.has(s.toLowerCase()));
    if (unknown.length > 0) {
      warn(`--${flag}: unknown collector ID (valid: ${[...validIds].join(', ')})`);
    }
  }

  // 1. Handle --wrap mode
  if (options.wrap) {
    const lineLimit = resolveLines(options.lines);
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

      if (result.exitCode === 0) {
        return 0;
      }

      // Non-zero exit -> proceed to collect pack
      const wrapBuffer = logBuffer.slice(-lineLimit).join('\n');
      return await generateAndOutput(
        { ...options, lines: String(lineLimit) },
        { wrapBuffer, exitCode: result.exitCode, issueTitlePrefix: fileConfig?.issueTitlePrefix }
      );
    } catch {
      process.stderr.write(`\n${pc.red('Error running wrapped command.')}\n`);
      return 1;
    }
  }

  // 2. Handle --stdin mode
  let stdinLog: string | undefined;
  if (options.stdin) {
    stdinLog = await readStdin();
  }

  return await generateAndOutput(options, { stdinLog, issueTitlePrefix: fileConfig?.issueTitlePrefix });
}

interface ExtraContext {
  wrapBuffer?: string;
  stdinLog?: string;
  exitCode?: number;
  issueTitlePrefix?: string;
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
    sourcemaps: options.sourcemaps,
    heuristics: options.heuristics,
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

  const markdown = renderReport(pack, options.template || 'default');

  // The issue URL goes to stderr on every output path, so --issue --stdout
  // and --issue --json still produce one (B-08.7).
  const printIssueUrl = (savedPath?: string) => {
    if (!options.issue || options.create) return;

    const gitSection = pack.sections.find((s) => s.id === 'git');
    const remoteMatch = (gitSection?.content || '').match(/Remote:\s*`([^`]+)`/);
    const { body, truncated } = issueBodyFor(markdown, savedPath);
    const issueInfo = extractIssueUrl(
      remoteMatch ? remoteMatch[1] : undefined,
      pack.projectName,
      body,
      extra.issueTitlePrefix
    );

    if (!issueInfo) {
      warn('--issue: no GitHub or GitLab remote detected');
      return;
    }
    if (truncated) {
      warn('report too large for a pre-filled URL; review and paste the full report from the saved file or local output');
    }
    process.stderr.write(`  ${pc.bold(`🔗 ${issueInfo.platform} Issue URL:`)}\n  ${pc.underline(pc.cyan(issueInfo.url))}\n\n`);
  };

  // Creation always keeps a local report, including machine-output modes.
  let savedForCreate: string | undefined;
  if (options.create) {
    const destination = options.out ?? path.join(os.tmpdir(), `crashpack-${Date.now()}.md`);
    try {
      fs.writeFileSync(destination, markdown, { encoding: 'utf8', mode: 0o600 });
      savedForCreate = destination;
    } catch {
      warn('Could not save report; issue creation skipped. Save the local output and create an issue manually.');
    }
  }

  const createIssue = async () => {
    if (!options.create || !savedForCreate) return;
    await createGithubIssue(markdown, pack.sections.find((s) => s.id === 'git')?.content, savedForCreate, isSilentMode || Boolean(options.stdin));
  };

  // Handle JSON output
  if (options.json) {
    process.stdout.write(JSON.stringify(pack, null, 2) + '\n');
    printIssueUrl();
    await createIssue();
    return extra.exitCode ?? 0;
  }

  // Handle stdout output
  if (options.stdout) {
    process.stdout.write(markdown + '\n');
    printIssueUrl();
    await createIssue();
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
  let outputPath = savedForCreate ?? options.out;
  if (!outputPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    outputPath = path.join(os.tmpdir(), `crashpack-${timestamp}.md`);
  }

  try {
    if (!savedForCreate) fs.writeFileSync(outputPath, markdown, { encoding: 'utf8', mode: 0o600 });
  } catch {
    // If filesystem is read-only, fallback to stdout
    process.stdout.write(markdown + '\n');
    return extra.exitCode ?? 0;
  }

  if (!isSilentMode) {
    const clipHeader = copiedToClipboard
      ? `${pc.bold(pc.green('📋 COPIED TO CLIPBOARD'))} ${pc.dim('Review before pasting into GitHub / Slack / AI')}`
      : `${pc.bold(pc.yellow('📄 REPORT SAVED'))} ${pc.dim(options.clipboard === false ? '(Clipboard disabled)' : '(Clipboard unavailable in this environment)')}`;

    const redactNote = pack.redactionCount > 0
      ? `${pc.yellow('🛡️ ')} ${pc.bold(pack.redactionCount.toString())} sensitive value${pack.redactionCount === 1 ? '' : 's'} masked as [redacted]`
      : 'No sensitive values matched the redaction rules';

    process.stderr.write(`${pc.cyan('╭──────────────────────────────────────────────────────────────────────────╮')}\n`);
    process.stderr.write(`${pc.cyan('│')}  ${clipHeader}\n`);
    process.stderr.write(`${pc.cyan('│')}\n`);
    process.stderr.write(`${pc.cyan('│')}  ${redactNote}\n`);
    process.stderr.write(`${pc.cyan('│')}  ${pc.dim('📁 Backup file:')} ${pc.cyan(displayOutputPath(outputPath))}\n`);
    process.stderr.write(`${pc.cyan('│')}  ${pc.dim('Redaction can miss secrets. Review the report before sharing.')}\n`);
    process.stderr.write(`${pc.cyan('╰──────────────────────────────────────────────────────────────────────────╯')}\n\n`);

  }

  printIssueUrl(outputPath);
  await createIssue();

  return extra.exitCode ?? 0;
}

function displayOutputPath(outputPath: string): string {
  const relative = path.relative(process.cwd(), outputPath);
  if (path.dirname(outputPath) === os.tmpdir()) return `[system temp]/${path.basename(outputPath).replace(/[\r\n\x1b]/g, '')}`;
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? `./${relative.replace(/[\r\n\x1b]/g, '')}`
    : '[local report file at the selected output path or in the system temp directory]';
}

async function createGithubIssue(markdown: string, gitContent: string | undefined, savedPath: string, machineOutput: boolean): Promise<void> {
  const recovery = 'The full local report is retained. Review it and create an issue manually.';
  if (markdown.length > 65_536) {
    warn(`Report too large for a GitHub issue body (65,536 characters). ${recovery}`);
    return;
  }
  if (machineOutput || !process.stdin.isTTY || !process.stderr.isTTY) {
    warn(`Issue creation needs an interactive terminal without --stdout, --json or --stdin. ${recovery}`);
    return;
  }
  const remote = gitContent?.match(/Remote:\s*`([^`]+)`/)?.[1];
  const issue = extractIssueUrl(remote);
  if (issue?.platform !== 'GitHub') {
    warn(`--create requires a GitHub remote. ${recovery}`);
    return;
  }
  const repo = new URL(issue.url).pathname.split('/').slice(1, 3).join('/');
  const ghEnv = { GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1' };
  process.stderr.write(`\nReview the complete report before sharing; redaction can miss secrets.\n${markdown}\n`);
  try {
    await execa('gh', ['--version'], { shell: false, timeout: 10_000, env: ghEnv });
    await execa('gh', ['auth', 'status', '--hostname', 'github.com'], { shell: false, timeout: 10_000, env: ghEnv });
  } catch {
    warn(`gh is unavailable or not authenticated. Install GitHub CLI and run gh auth login. ${recovery}`);
    return;
  }
  const input = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const title = (await input.question('Issue title: ')).trim();
    if (!title || /[\r\n\x00-\x1f]/.test(title)) {
      warn(`A nonempty single-line title is required. ${recovery}`);
      return;
    }
    const confirmation = await input.question(`Upload this report to github.com/${repo}? Type yes to confirm: `);
    if (confirmation.trim().toLowerCase() !== 'yes') {
      warn(`Issue creation cancelled. ${recovery}`);
      return;
    }
    // Restore the exact reviewed content in case the file changed during review.
    fs.writeFileSync(savedPath, markdown, { encoding: 'utf8', mode: 0o600 });
    await execa('gh', ['issue', 'create', '--repo', repo, '--title', title, '--body-file', savedPath], { shell: false, timeout: 30_000, env: ghEnv });
    process.stderr.write(`Issue created in https://github.com/${repo}/issues.\n`);
  } catch {
    warn(`Issue creation did not complete. Check the repository before retrying to avoid duplicates. ${recovery}`);
  } finally {
    input.close();
  }
}

// Auto-run if executed directly as script
if (process.argv[1] && (process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('cli.ts'))) {
  runCli().then((code) => {
    process.exit(code);
  });
}
