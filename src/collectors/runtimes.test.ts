import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { collectRuntimes } from './runtimes.js';

let directory: string | undefined;
afterEach(() => {
  vi.unstubAllEnvs();
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
  directory = undefined;
});

function fixture() {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'crashpack runtime fixture '));
  vi.stubEnv('PATH', directory);
  if (process.platform === 'win32') {
    vi.stubEnv('Path', directory);
    vi.stubEnv('PATHEXT', '.COM;.EXE;.BAT;.CMD');
  }
  return directory;
}

describe('runtime executable discovery', () => {
  it('finds version shims through PATH, including Windows cmd files in a directory with spaces', async () => {
    const cwd = fixture();
    const versions = {
      python3: 'Python 3.11.1', python: 'Python 3.11.1', go: 'go version go1.22.1 synthetic/amd64',
      rustc: 'rustc 1.80.1', bun: '1.2.3', deno: 'deno 2.1.1', pnpm: '9.1.1', yarn: '1.22.1', npm: '10.1.1',
    };
    for (const [command, version] of Object.entries(versions)) {
      const windows = process.platform === 'win32';
      fs.writeFileSync(path.join(cwd, command + (windows ? '.cmd' : '')), windows
        ? `@echo off\r\necho ${version}\r\n`
        : `#!/bin/sh\nprintf '%s\\n' '${version}'\n`, { mode: 0o755 });
    }
    const result = await collectRuntimes({ cwd, timeoutMs: 2000 });
    expect(result.status).toBe('ok');
    expect(result.data).toEqual({
      Node: process.version.slice(1), Python: '3.11.1', Go: '1.22.1', Rust: '1.80.1', Bun: '1.2.3',
      Deno: '2.1.1', pnpm: '9.1.1', yarn: '1.22.1', npm: '10.1.1',
    });
    expect(result.rawContent).toContain('- npm `10.1.1`');
  });

  it('keeps the running Node version when optional executables are missing', async () => {
    const cwd = fixture();
    const result = await collectRuntimes({ cwd, timeoutMs: 100 });
    expect(result.status).toBe('ok');
    expect(result.data).toEqual({ Node: process.version.slice(1) });
    expect(result.rawContent).toBe(`- Node \`${process.version.slice(1)}\``);
  });

  it('does not wait for inherited output pipes after a version probe times out', async () => {
    const cwd = fixture();
    const child = path.join(cwd, 'slow-version.js');
    fs.writeFileSync(child, "console.log('999.9.9'); setTimeout(() => {}, 3000);\n");
    const windows = process.platform === 'win32';
    fs.writeFileSync(path.join(cwd, 'npm' + (windows ? '.cmd' : '')), windows
      ? `@echo off\r\n"${process.execPath}" "${child}"\r\n`
      : `#!/bin/sh\n"${process.execPath}" "${child}"\n`, { mode: 0o755 });
    const started = Date.now();
    const result = await collectRuntimes({ cwd, timeoutMs: 200 });
    expect(Date.now() - started).toBeLessThan(1500);
    expect(result.data).toEqual({ Node: process.version.slice(1) });
  });
});
