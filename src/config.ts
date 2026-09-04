import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';

export interface CrashpackConfig {
  only?: string[];
  skip?: string[];
  redactExtra?: string[];
  lines?: number;
}

const CANDIDATES = [
  '.crashpackrc',
  '.crashpackrc.json',
  '.crashpackrc.toml',
  'crashpack.config.json',
];

/** True when a config file exists, whether or not it parsed (B-12). */
export function configFileFound(cwd: string = process.cwd()): boolean {
  return CANDIDATES.some((f) => fs.existsSync(path.join(cwd, f)));
}

export function loadConfig(cwd: string = process.cwd()): CrashpackConfig | null {
  const candidates = CANDIDATES;

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
