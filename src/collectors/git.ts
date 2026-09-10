import { execa } from 'execa';
import { asRawText, Collector } from '../types.js';
import { fenceFor } from '../render/fence.js';

export const collectGit: Collector = async (ctx) => {
  const timeout = ctx.timeoutMs ?? 2000;
  const cwd = ctx.cwd;

  try {
    // Check if inside git work tree
    const isRepo = await execa('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd,
      timeout,
      reject: false,
    });

    if (isRepo.exitCode !== 0 || isRepo.stdout.trim() !== 'true') {
      return {
        id: 'git',
        title: 'Git',
        status: 'unavailable',
        unavailableReason: 'not a git repository',
      };
    }

    // These five are independent of one another. Running them sequentially at
    // 2s each made git the ceiling on total runtime (B-07).
    const logArgs = ctx.since
      ? ['log', '-n', '10', `--since=${ctx.since}`, '--format=- `%h` %s — %cr']
      : ['log', '-n', '3', '--format=- `%h` %s — %cr'];

    const opts = { cwd, timeout, reject: false as const };
    const [branchRes, remoteRes, statusRes, logRes, diffRes] = await Promise.all([
      execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], opts),
      execa('git', ['config', '--get', 'remote.origin.url'], opts),
      execa('git', ['status', '--porcelain'], opts),
      execa('git', logArgs, opts),
      execa('git', ['diff', 'HEAD'], opts),
    ]);

    // Branch
    let branch = 'unknown';
    if (branchRes.exitCode === 0 && branchRes.stdout.trim()) {
      branch = branchRes.stdout.trim();
    }

    // Remote
    let remote = 'none';
    if (remoteRes.exitCode === 0 && remoteRes.stdout.trim()) {
      remote = remoteRes.stdout.trim();
      // Clean git@ URLs or https:// tokens if any
      remote = remote.replace(/^git@([^:]+):/, '$1/').replace(/\.git$/, '');
    }

    // Uncommitted files
    const statusLines = statusRes.exitCode === 0 && statusRes.stdout.trim()
      ? statusRes.stdout.trim().split('\n').filter(Boolean)
      : [];
    const uncommittedCount = statusLines.length;

    // Commits (support --since if provided)
    let commitsSection = '';
    const commitLabel = ctx.since ? `**Commits since ${ctx.since}**` : `**Last 3 commits**`;
    if (logRes.exitCode === 0 && logRes.stdout.trim()) {
      commitsSection = `${commitLabel}\n${logRes.stdout.trim()}`;
    } else {
      commitsSection = `${commitLabel}\n- No commits found`;
    }

    // Diff
    let diffSection = '';
    let diffOutput = diffRes.exitCode === 0 ? diffRes.stdout : '';
    // If diff HEAD failed (e.g. initial commit with no HEAD), try git diff
    if (diffRes.exitCode !== 0) {
      const fallbackDiff = await execa('git', ['diff'], { cwd, timeout, reject: false });
      if (fallbackDiff.exitCode === 0) {
        diffOutput = fallbackDiff.stdout;
      }
    }

    if (diffOutput.trim()) {
      const diffLines = diffOutput.split('\n');
      let truncated = false;
      let finalDiff = diffLines;
      if (diffLines.length > 500) {
        finalDiff = diffLines.slice(0, 500);
        truncated = true;
      }
      const diffBody = `${finalDiff.join('\n')}${truncated ? '\n... [diff truncated at 500 lines]' : ''}`;
      const fence = fenceFor(diffBody);
      diffSection = `\n\n**Diff**\n${fence}diff\n${diffBody}\n${fence}`;
    }

    const lines: string[] = [
      `- Branch: \`${branch}\``,
      `- Remote: \`${remote}\``,
      `- Uncommitted changes: ${uncommittedCount} file${uncommittedCount === 1 ? '' : 's'}`,
      '',
      commitsSection,
    ];

    if (diffSection) {
      lines.push(diffSection);
    }

    return {
      id: 'git',
      title: 'Git',
      status: 'ok',
      rawContent: asRawText(lines.join('\n')),
    };
  } catch (err: any) {
    return {
      id: 'git',
      title: 'Git',
      status: 'unavailable',
      unavailableReason: err?.message || 'git command failed',
    };
  }
};
