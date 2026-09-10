import { execa } from 'execa';
import { asRawText, Collector } from '../types.js';

const MAX_CONTAINERS = 15;

export const collectDocker: Collector = async (ctx) => {
  const timeout = ctx.timeoutMs ?? 2000;

  try {
    // Check if docker CLI is installed and daemon is responsive
    const infoRes = await execa('docker', ['info', '--format', '{{.ServerVersion}}'], {
      timeout,
      reject: false,
    });

    if (infoRes.exitCode !== 0) {
      const errOutput = (infoRes.stderr || infoRes.stdout || '').toLowerCase();
      if (errOutput.includes('daemon') || errOutput.includes('connect') || errOutput.includes('pipe')) {
        return {
          id: 'docker',
          title: 'Docker',
          status: 'unavailable',
          unavailableReason: 'daemon not running',
        };
      }
      return {
        id: 'docker',
        title: 'Docker',
        status: 'unavailable',
        unavailableReason: 'docker not installed',
      };
    }

    // List recent containers
    const psRes = await execa(
      'docker',
      ['ps', '-a', '--format', '{{.Names}}\t{{.Status}}\t{{.State}}'],
      {
        timeout,
        reject: false,
      }
    );

    const lines: string[] = ['- Daemon: running'];

    if (psRes.exitCode === 0 && psRes.stdout.trim()) {
      const entries = psRes.stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [name = 'unknown', status = 'unknown', state = ''] = line.split('\t');
          // Anything not cleanly exited is worth the reader's attention.
          const relevant =
            (state === 'exited' || state === 'dead' ||
             status.toLowerCase().includes('exited (') ||
             status.toLowerCase().includes('unhealthy')) &&
            !status.includes('Exited (0)');
          return { name, status, relevant };
        });

      // `docker ps -a` is unbounded and lists long-dead containers from
      // unrelated projects. Surface the relevant ones and cap the rest (B-09).
      const ordered = [...entries].sort((a, b) => Number(b.relevant) - Number(a.relevant));
      const shown = ordered.slice(0, MAX_CONTAINERS);
      const remaining = ordered.length - shown.length;

      for (const { name, status, relevant } of shown) {
        lines.push(`- \`${name}\` — ${status}${relevant ? '  ← likely relevant' : ''}`);
      }
      if (remaining > 0) {
        lines.push(`_...and ${remaining} more_`);
      }
    } else {
      lines.push('- No active containers');
    }

    return {
      id: 'docker',
      title: 'Docker',
      status: 'ok',
      rawContent: asRawText(lines.join('\n')),
    };
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('enoent') || msg.includes('not found')) {
      return {
        id: 'docker',
        title: 'Docker',
        status: 'unavailable',
        unavailableReason: 'docker not installed',
      };
    }
    return {
      id: 'docker',
      title: 'Docker',
      status: 'unavailable',
      unavailableReason: 'daemon not running',
    };
  }
};
