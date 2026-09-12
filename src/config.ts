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
  template?: 'default' | 'envinfo' | 'minimal';
  issueTitlePrefix?: string;
  sections?: string[];
  sourcemaps?: boolean;
  heuristics?: boolean;
}

const CANDIDATES = [
  '.crashpackrc',
  '.crashpackrc.json',
  '.crashpackrc.toml',
  'crashpack.config.json',
];

const KNOWN_SECTIONS = new Set([
  'logs',
  'git',
  'system',
  'runtimes',
  'packages',
  'docker',
  'ports',
  'env',
]);

const VALID_TEMPLATES = new Set(['default', 'envinfo', 'minimal']);

function validate(value: unknown): CrashpackConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  for (const [key, item] of Object.entries(value)) {
    switch (key) {
      case 'only':
      case 'skip':
      case 'redactExtra':
        if (!Array.isArray(item) || !item.every((entry) => typeof entry === 'string')) throw new Error();
        break;
      case 'lines':
        if (!Number.isSafeInteger(item) || item <= 0) throw new Error();
        break;
      case 'clipboard':
      case 'sourcemaps':
      case 'heuristics':
        if (typeof item !== 'boolean') throw new Error();
        break;
      case 'out':
      case 'issueTitlePrefix':
        if (typeof item !== 'string' || !item.trim()) throw new Error();
        break;
      case 'template':
        if (typeof item !== 'string' || !VALID_TEMPLATES.has(item)) throw new Error();
        break;
      case 'sections':
        if (!Array.isArray(item) || !item.every((entry) => typeof entry === 'string')) throw new Error();
        for (const s of item) {
          if (!KNOWN_SECTIONS.has(s.toLowerCase())) {
            process.stderr.write(`warning: unknown section "${s}" in config\n`);
          }
        }
        break;
      default:
        throw new Error();
    }
  }
  return value as CrashpackConfig;
}

function loadFromDir(dir: string): CrashpackConfig | null {
  for (const filename of [...CANDIDATES, 'package.json']) {
    const fullPath = path.join(dir, filename);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (filename === 'package.json') {
          const pkg = JSON.parse(content);
          return Object.hasOwn(pkg, 'crashpack') ? validate(pkg.crashpack) : null;
        }
        const toml =
          filename.endsWith('.toml') ||
          (filename === '.crashpackrc' && !content.trim().startsWith('{') && content.includes('='));
        return validate(toml ? parseToml(content) : JSON.parse(content));
      } catch {
        throw new Error('Invalid crashpack configuration. Check syntax and supported option types.');
      }
    }
  }
  return null;
}

function findGitRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

export function loadConfig(cwd: string = process.cwd()): CrashpackConfig | null {
  const start = path.resolve(cwd);
  const gitRoot = findGitRoot(start);

  let current = start;
  while (true) {
    const config = loadFromDir(current);
    if (config) {
      return config;
    }

    if (!gitRoot || current === gitRoot) {
      break;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return null;
}
