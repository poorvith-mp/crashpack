import * as os from 'node:os';
import * as fs from 'node:fs';
import { asRawText, Collector } from '../types.js';

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function formatTotalBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${Math.round(gb)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)} MB`;
}

function getOsName(platform: string, release: string, arch: string): string {
  let name = platform;
  if (platform === 'darwin') {
    name = 'macOS';
  } else if (platform === 'win32') {
    name = 'Windows';
  } else if (platform === 'linux') {
    name = 'Linux';
  }
  return `${name} ${release} (${arch})`;
}

export const collectSystem: Collector = async (ctx) => {
  try {
    const platform = os.platform();
    const release = os.release();
    const arch = os.arch();
    const osString = getOsName(platform, release, arch);

    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model.trim() : 'Unknown CPU';
    const cpuCores = cpus.length;
    const cpuString = `${cpuModel}, ${cpuCores} cores`;

    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const memString = `${formatBytes(freeMem)} free of ${formatTotalBytes(totalMem)}`;

    let diskString = 'Unavailable';
    try {
      if (typeof fs.statfsSync === 'function') {
        const stats = fs.statfsSync(ctx.cwd || process.cwd());
        const totalDisk = stats.blocks * stats.bsize;
        const freeDisk = stats.bavail * stats.bsize;
        diskString = `${formatBytes(freeDisk)} free of ${formatTotalBytes(totalDisk)}`;
      }
    } catch {
      diskString = 'Unavailable';
    }

    const tableRows = [
      '| | |',
      '|---|---|',
      `| OS | ${osString} |`,
      `| CPU | ${cpuString} |`,
      `| Memory | ${memString} |`,
    ];

    if (diskString !== 'Unavailable') {
      tableRows.push(`| Disk | ${diskString} |`);
    }

    return {
      id: 'system',
      title: 'System',
      status: 'ok',
      rawContent: asRawText(tableRows.join('\n')),
    };
  } catch (err: any) {
    return {
      id: 'system',
      title: 'System',
      status: 'unavailable',
      unavailableReason: err?.message || 'failed to read system info',
    };
  }
};
