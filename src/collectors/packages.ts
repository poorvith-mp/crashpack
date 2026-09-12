import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { asRawText, Collector } from '../types.js';

interface PackageItem {
  name: string;
  version: string;
}

/**
 * Prefer the version actually installed (B-05).
 *
 * A manifest range tells a maintainer what the reporter is *allowed* to run,
 * which they could read from the repo themselves. The one number worth having
 * in a bug report is what is actually on disk.
 */
function resolveNodeVersion(cwd: string, name: string, declared: string): string {
  try {
    const manifest = path.join(cwd, 'node_modules', ...name.split('/'), 'package.json');
    const version = JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
    if (typeof version === 'string' && version) return version;
  } catch {
    // Not installed — fall through to the declared range.
  }
  // Rendered as written ('^15.0.3'), so a range never masquerades as exact.
  return declared;
}

export const collectPackages: Collector = async (ctx) => {
  const cwd = ctx.cwd;
  const packages: PackageItem[] = [];

  // 1. Node.js (package.json)
  const pkgJsonPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const content = fs.readFileSync(pkgJsonPath, 'utf8');
      const json = JSON.parse(content);
      const deps = { ...json.dependencies, ...json.devDependencies };
      for (const [name, ver] of Object.entries(deps)) {
        packages.push({ name, version: resolveNodeVersion(cwd, name, String(ver)) });
      }
    } catch {
      // Ignored
    }
  }

  // 2. Python (requirements.txt, pyproject.toml)
  const reqTxtPath = path.join(cwd, 'requirements.txt');
  if (fs.existsSync(reqTxtPath)) {
    try {
      const content = fs.readFileSync(reqTxtPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([a-zA-Z0-9_.-]+)(?:[=><~]=?|@)?\s*([0-9a-zA-Z_.-]+)?/);
          if (match && match[1]) {
            packages.push({ name: match[1], version: match[2] || 'any' });
          }
        }
      }
    } catch {
      // Ignored
    }
  }

  const pyprojectPath = path.join(cwd, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    try {
      const content = fs.readFileSync(pyprojectPath, 'utf8');
      const parsed: any = parseToml(content);
      const deps = parsed?.project?.dependencies || parsed?.['tool']?.poetry?.dependencies;
      if (Array.isArray(deps)) {
        for (const dep of deps) {
          const match = String(dep).match(/^([a-zA-Z0-9_.-]+)(?:[=><~]=?|@)?\s*([0-9a-zA-Z_.-]+)?/);
          if (match && match[1]) {
            packages.push({ name: match[1], version: match[2] || 'any' });
          }
        }
      } else if (deps && typeof deps === 'object') {
        for (const [name, ver] of Object.entries(deps)) {
          packages.push({ name, version: String(ver) });
        }
      }
    } catch {
      // Ignored
    }
  }

  // 3. Rust (Cargo.toml)
  const cargoPath = path.join(cwd, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    try {
      const content = fs.readFileSync(cargoPath, 'utf8');
      const parsed: any = parseToml(content);
      const deps = { ...parsed?.dependencies, ...parsed?.['dev-dependencies'] };
      for (const [name, val] of Object.entries(deps)) {
        let ver = 'any';
        if (typeof val === 'string') {
          ver = val;
        } else if (typeof val === 'object' && val !== null && (val as any).version) {
          ver = (val as any).version;
        }
        packages.push({ name, version: ver });
      }
    } catch {
      // Ignored
    }
  }

  // 4. Go (go.mod)
  const goModPath = path.join(cwd, 'go.mod');
  if (fs.existsSync(goModPath)) {
    try {
      const content = fs.readFileSync(goModPath, 'utf8');
      const lines = content.split('\n');
      let inRequire = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('require (')) {
          inRequire = true;
          continue;
        }
        if (inRequire && trimmed === ')') {
          inRequire = false;
          continue;
        }
        if (inRequire || trimmed.startsWith('require ')) {
          const parts = trimmed.replace(/^require\s+/, '').split(/\s+/);
          if (parts.length >= 2) {
            packages.push({ name: parts[0], version: parts[1] });
          }
        }
      }
    } catch {
      // Ignored
    }
  }

  if (packages.length === 0) {
    return {
      id: 'packages',
      title: 'Packages',
      status: 'unavailable',
      unavailableReason: 'no package manifests found',
      data: packages,
    };
  }

  // Truncate at 20 items per spec
  const limit = 20;
  const displayed = packages.slice(0, limit);
  const remaining = packages.length - limit;

  const rows = [
    '| Package | Version |',
    '|---|---|',
    ...displayed.map((p) => `| ${p.name} | ${p.version} |`),
  ];

  if (remaining > 0) {
    rows.push(`_...and ${remaining} more_`);
  }

  return {
    id: 'packages',
    title: 'Packages',
    status: 'ok',
    rawContent: asRawText(rows.join('\n')),
    data: packages,
  };
};
