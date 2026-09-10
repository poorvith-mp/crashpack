import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';

export interface CrashpackConfig {
  only?: string[];
  skip?: string[];
  redactExtra?: string[];
  lines?: number;
  clipboard?: boolean;
  out?: string;
}

const CANDIDATES = [
  '.crashpackrc',
  '.crashpackrc.json',
  '.crashpackrc.toml',
  'crashpack.config.json',
];

function validate(value: unknown): CrashpackConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  for (const [key, item] of Object.entries(value)) {
    switch (key) {
      case 'only': case 'skip': case 'redactExtra':
        if (!Array.isArray(item) || !item.every((entry) => typeof entry === 'string')) throw new Error();
        break;
      case 'lines':
        if (!Number.isSafeInteger(item) || item <= 0) throw new Error();
        break;
      case 'clipboard':
        if (typeof item !== 'boolean') throw new Error();
        break;
      case 'out':
        if (typeof item !== 'string' || !item.trim()) throw new Error();
        break;
      default: throw new Error();
    }
  }
  return value as CrashpackConfig;
}

export function loadConfig(cwd: string = process.cwd()): CrashpackConfig | null {
  for (const filename of [...CANDIDATES, 'package.json']) {
    const fullPath = path.join(cwd, filename);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (filename === 'package.json') {
          const pkg = JSON.parse(content);
          return Object.hasOwn(pkg, 'crashpack') ? validate(pkg.crashpack) : null;
        }
        const toml = filename.endsWith('.toml') || (filename === '.crashpackrc' && !content.trim().startsWith('{') && content.includes('='));
        return validate(toml ? parseToml(content) : JSON.parse(content));
      } catch {
        throw new Error('Invalid crashpack configuration. Check syntax and supported option types.');
      }
    }
  }
  return null;
}
