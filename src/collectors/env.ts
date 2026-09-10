import * as fs from 'node:fs';
import * as path from 'node:path';
import { asRawText, Collector } from '../types.js';

const ENV_FILENAMES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.test',
  '.env.production',
];

export const collectEnv: Collector = async (ctx) => {
  const cwd = ctx.cwd;
  const keySet = new Set<string>();
  let foundAnyEnvFile = false;

  for (const filename of ENV_FILENAMES) {
    const fullPath = path.join(cwd, filename);
    if (fs.existsSync(fullPath)) {
      try {
        foundAnyEnvFile = true;
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            // Match key name ONLY before '=' or ':'
            const match = trimmed.match(/^(?:export\s+)?([A-Za-z0-9_]+)\s*[:=]/);
            if (match && match[1]) {
              keySet.add(match[1]);
            }
          }
        }
      } catch {
        // Ignored
      }
    }
  }

  if (!foundAnyEnvFile || keySet.size === 0) {
    return {
      id: 'env',
      title: 'Environment',
      status: 'unavailable',
      unavailableReason: 'no .env file found',
    };
  }

  const keys = Array.from(keySet).sort();
  const summary = `_${keys.length} key${keys.length === 1 ? '' : 's'} present. Values redacted. Keys: ${keys.join(', ')}_`;

  return {
    id: 'env',
    title: 'Environment',
    status: 'ok',
    rawContent: asRawText(summary),
  };
};
