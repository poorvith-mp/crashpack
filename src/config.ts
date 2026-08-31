import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';

export interface CrashpackConfig {
  only?: string[];
  skip?: string[];
  redactExtra?: string[];
  lines?: number;
}

export function loadConfig(cwd: string = process.cwd()): CrashpackConfig | null {
  const candidates = [
    '.crashpackrc',
    '.crashpackrc.json',
    '.crashpackrc.toml',
    'crashpack.config.json',
  ];

  for (const filename of candidates) {
    const fullPath = path.join(cwd, filename);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (filename.endsWith('.toml') || (!content.trim().startsWith('{') && content.includes('='))) {
          return parseToml(content) as CrashpackConfig;
        }
        return JSON.parse(content) as CrashpackConfig;
      } catch {
        return null;
      }
    }
  }
  return null;
}
