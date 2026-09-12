import { CrashPack } from '../../types.js';
import { fenceFor } from '../fence.js';

export function renderEnvinfo(pack: CrashPack): string {
  const blocks: string[] = [];

  // 1. System
  const systemSec = pack.sections.find((s) => s.id === 'system');
  if (systemSec && systemSec.status === 'ok' && systemSec.content) {
    const sysLines = ['  System:'];
    const lines = systemSec.content.split('\n');
    for (const line of lines) {
      const match = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/);
      if (match && match[1] !== ' ' && !match[1].startsWith('---')) {
        const key = match[1].trim();
        const val = match[2].trim();
        sysLines.push(`    ${key}: ${val}`);
      }
    }
    blocks.push(sysLines.join('\n'));
  }

  // 2. Binaries (from runtimes)
  const runtimesSec = pack.sections.find((s) => s.id === 'runtimes');
  if (runtimesSec && runtimesSec.status === 'ok') {
    const binLines = ['  Binaries:'];
    if (runtimesSec.data && typeof runtimesSec.data === 'object') {
      for (const [name, ver] of Object.entries(runtimesSec.data as Record<string, string>)) {
        binLines.push(`    ${name}: ${ver}`);
      }
    } else if (runtimesSec.content) {
      for (const line of runtimesSec.content.split('\n')) {
        const match = line.match(/^-\s*([A-Za-z0-9_.-]+)\s*`([^`]+)`/);
        if (match) {
          binLines.push(`    ${match[1]}: ${match[2]}`);
        }
      }
    }
    if (binLines.length > 1) {
      blocks.push(binLines.join('\n'));
    }
  }

  // 3. npmPackages (from packages)
  const packagesSec = pack.sections.find((s) => s.id === 'packages');
  if (packagesSec && packagesSec.status === 'ok') {
    const pkgLines = ['  npmPackages:'];
    if (Array.isArray(packagesSec.data)) {
      for (const item of packagesSec.data) {
        if (item && item.name && item.version) {
          pkgLines.push(`    ${item.name}: ${item.version}`);
        }
      }
    } else if (packagesSec.content) {
      for (const line of packagesSec.content.split('\n')) {
        const match = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/);
        if (match && match[1] !== 'Package' && !match[1].startsWith('---')) {
          pkgLines.push(`    ${match[1].trim()}: ${match[2].trim()}`);
        }
      }
    }
    if (pkgLines.length > 1) {
      blocks.push(pkgLines.join('\n'));
    }
  }

  let result = blocks.join('\n');

  // Followed by Crashpack's Logs and Git sections
  const logsSec = pack.sections.find((s) => s.id === 'logs');
  if (logsSec && logsSec.status === 'ok' && logsSec.content) {
    const fence = fenceFor(logsSec.content);
    result += `\n\n## ${logsSec.title}\n\n${fence}\n${logsSec.content}\n${fence}`;
  }

  const gitSec = pack.sections.find((s) => s.id === 'git');
  if (gitSec && gitSec.status === 'ok' && gitSec.content) {
    result += `\n\n## ${gitSec.title}\n\n${gitSec.content}`;
  }

  result += `\n\n---\n_Generated locally by crashpack (envinfo template) · Built by Poorvith._\n`;
  return result;
}
