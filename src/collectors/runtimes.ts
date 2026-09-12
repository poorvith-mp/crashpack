import { execa } from 'execa';
import { asRawText, Collector } from '../types.js';

interface RuntimeCheck {
  name: string;
  command: string;
  args: string[];
  parseVersion: (output: string) => string | null;
}

const RUNTIME_CHECKS: RuntimeCheck[] = [
  {
    name: 'Node',
    command: 'node',
    args: ['--version'],
    parseVersion: (out) => {
      const match = out.trim().match(/v?(\d+\.\d+\.\d+)/);
      return match ? match[1] : out.trim().replace(/^v/, '');
    },
  },
  {
    name: 'Python',
    command: 'python3',
    args: ['--version'],
    parseVersion: (out) => {
      const match = out.trim().match(/Python\s+([0-9a-zA-Z.-]+)/i);
      return match ? match[1] : null;
    },
  },
  {
    name: 'Python (py)',
    command: 'python',
    args: ['--version'],
    parseVersion: (out) => {
      const match = out.trim().match(/Python\s+([0-9a-zA-Z.-]+)/i);
      return match ? match[1] : null;
    },
  },
  {
    name: 'Go',
    command: 'go',
    args: ['version'],
    parseVersion: (out) => {
      const match = out.trim().match(/go(\d+\.\d+(?:\.\d+)?)/);
      return match ? match[1] : null;
    },
  },
  {
    name: 'Rust',
    command: 'rustc',
    args: ['--version'],
    parseVersion: (out) => {
      const match = out.trim().match(/rustc\s+(\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    },
  },
  {
    name: 'Bun',
    command: 'bun',
    args: ['--version'],
    parseVersion: (out) => {
      const match = out.trim().match(/^(\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    },
  },
  {
    name: 'Deno',
    command: 'deno',
    args: ['--version'],
    parseVersion: (out) => {
      const match = out.trim().match(/deno\s+(\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    },
  },
  {
    name: 'pnpm',
    command: 'pnpm',
    args: ['--version'],
    parseVersion: (out) => {
      const match = out.trim().match(/^(\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    },
  },
  {
    name: 'yarn',
    command: 'yarn',
    args: ['--version'],
    parseVersion: (out) => {
      const match = out.trim().match(/^(\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    },
  },
  {
    name: 'npm',
    command: 'npm',
    args: ['--version'],
    parseVersion: (out) => {
      const match = out.trim().match(/^(\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    },
  },
];

export const collectRuntimes: Collector = async (ctx) => {
  const timeout = ctx.timeoutMs ?? 2000;
  const foundRuntimes: Record<string, string> = {};

  // Always record current running Node version first
  if (process.version) {
    foundRuntimes['Node'] = process.version.replace(/^v/, '');
  }

  // Probe other runtimes in parallel
  const probes = RUNTIME_CHECKS.map(async (check) => {
    // Skip if already found (e.g. Node or Python3 vs Python)
    if (check.name === 'Node' && foundRuntimes['Node']) return;
    if (check.name.startsWith('Python') && foundRuntimes['Python']) return;

    const commandsToTry = process.platform === 'win32'
      ? [check.command, `${check.command}.cmd`]
      : [check.command];

    for (const cmd of commandsToTry) {
      try {
        const res = await execa(cmd, check.args, {
          timeout,
          reject: false,
        });

        const output = (res.stdout || res.stderr || '').trim();
        if (res.exitCode === 0 && output) {
          const ver = check.parseVersion(output);
          if (ver) {
            const key = check.name.startsWith('Python') ? 'Python' : check.name;
            if (!foundRuntimes[key]) {
              foundRuntimes[key] = ver;
            }
            break;
          }
        }
      } catch {
        // Ignored - try next command
      }
    }
  });

  await Promise.allSettled(probes);

  const lines = Object.entries(foundRuntimes).map(([name, ver]) => `- ${name} \`${ver}\``);

  if (lines.length === 0) {
    return {
      id: 'runtimes',
      title: 'Runtimes',
      status: 'unavailable',
      unavailableReason: 'no common runtimes detected',
      data: foundRuntimes,
    };
  }

  return {
    id: 'runtimes',
    title: 'Runtimes',
    status: 'ok',
    rawContent: asRawText(lines.join('\n')),
    data: foundRuntimes,
  };
};
