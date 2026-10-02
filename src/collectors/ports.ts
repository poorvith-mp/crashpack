import * as net from 'node:net';
import { asRawText, Collector } from '../types.js';

interface PortInfo {
  port: number;
  label: string;
}

export const COMMON_PORTS: PortInfo[] = [
  { port: 3000, label: 'dev/node' },
  { port: 3001, label: 'dev' },
  { port: 4000, label: 'dev' },
  { port: 5000, label: 'dev/flask' },
  { port: 5173, label: 'vite' },
  { port: 8000, label: 'dev/django' },
  { port: 8080, label: 'http/proxy' },
  { port: 8888, label: 'jupyter/dev' },
  { port: 5432, label: 'postgres' },
  { port: 3306, label: 'mysql' },
  { port: 6379, label: 'redis' },
  { port: 27017, label: 'mongodb' },
  { port: 9200, label: 'elasticsearch' },
];

export function parsePowerShellPorts(stdout: string): number[] {
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === 'number' ? item : item?.LocalPort))
        .filter((p): p is number => typeof p === 'number');
    }
    if (typeof parsed === 'number') return [parsed];
    if (parsed && typeof parsed.LocalPort === 'number') return [parsed.LocalPort];
  } catch {}
  return [];
}

function checkPort(port: number, timeoutMs = 250): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(true);
      }
    });

    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    try {
      socket.connect(port, '127.0.0.1');
    } catch {
      resolve(false);
    }
  });
}

export const collectPorts: Collector = async (_ctx) => {
  if (process.platform === 'win32') {
    try {
      const { execa } = await import('execa');
      const res = await execa(
        'powershell',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          'Get-NetTCPConnection -State Listen -ErrorAction Stop | Select-Object -Property LocalPort -Unique | ConvertTo-Json',
        ],
        { timeout: 3000 }
      );

      const listeningPorts = new Set(parsePowerShellPorts(res.stdout || ''));
      const activePorts: { port: number; label: string }[] = [];
      for (const { port, label } of COMMON_PORTS) {
        if (listeningPorts.has(port)) {
          activePorts.push({ port, label });
        }
      }

      activePorts.sort((a, b) => a.port - b.port);

      if (activePorts.length === 0) {
        return {
          id: 'ports',
          title: 'Ports',
          status: 'ok',
          rawContent: asRawText('- No common dev ports listening'),
        };
      }

      const lines = activePorts.map((p) => `- \`${p.port}\` — likely ${p.label}`);
      return {
        id: 'ports',
        title: 'Ports',
        status: 'ok',
        rawContent: asRawText(lines.join('\n')),
      };
    } catch {
      // If PowerShell fails or times out, fall through to socket probing fallback
    }
  }
  const activePorts: { port: number; label: string }[] = [];

  const checks = COMMON_PORTS.map(async ({ port, label }) => {
    const isOpen = await checkPort(port);
    if (isOpen) {
      activePorts.push({ port, label });
    }
  });

  await Promise.all(checks);

  activePorts.sort((a, b) => a.port - b.port);

  if (activePorts.length === 0) {
    return {
      id: 'ports',
      title: 'Ports',
      status: 'ok',
      rawContent: asRawText('- No common dev ports listening'),
    };
  }

  // Labels are inferred from the port number; no process is identified (B-14).
  const lines = activePorts.map((p) => `- \`${p.port}\` — likely ${p.label}`);

  return {
    id: 'ports',
    title: 'Ports',
    status: 'ok',
    rawContent: asRawText(lines.join('\n')),
  };
};
