import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { collectPackages } from './packages.js';

function tempProject(pkg: object, installed?: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crashpack-pkg-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg), 'utf8');

  for (const [name, version] of Object.entries(installed ?? {})) {
    const modDir = path.join(dir, 'node_modules', ...name.split('/'));
    fs.mkdirSync(modDir, { recursive: true });
    fs.writeFileSync(path.join(modDir, 'package.json'), JSON.stringify({ name, version }), 'utf8');
  }
  return dir;
}

describe('Resolved package versions (B-05)', () => {
  it('reports the installed version, not the declared range', async () => {
    const cwd = tempProject(
      { dependencies: { next: '^15.0.3' } },
      { next: '15.4.2' }
    );

    const res = await collectPackages({ cwd });
    expect(res.rawContent).toContain('15.4.2');
    expect(res.rawContent).not.toContain('15.0.3');
  });

  it('renders an uninstalled dependency as a range, not a fake exact version', async () => {
    const cwd = tempProject({ dependencies: { next: '^15.0.3' } });

    const res = await collectPackages({ cwd });
    // The caret must survive: a range that looks exact is worse than a range.
    expect(res.rawContent).toContain('^15.0.3');
  });

  it('resolves scoped packages', async () => {
    const cwd = tempProject(
      { devDependencies: { '@types/node': '^22.13.4' } },
      { '@types/node': '22.15.1' }
    );

    const res = await collectPackages({ cwd });
    expect(res.rawContent).toContain('22.15.1');
  });
});
