import { describe, it, expect } from 'vitest';
import { runHeuristics, Finding } from './index.js';
import { CrashPack } from '../types.js';

describe('Heuristics engine', () => {
  it('detects Next.js 15.0.3 and React 18.3.1 mismatch with exact spec sentence', () => {
    const packagesData = [
      { name: 'next', version: '15.0.3' },
      { name: 'react', version: '18.3.1' },
    ];
    const findings = runHeuristics({
      packagesData,
      runtimesData: { Node: '20.18.0' },
      runtimesStatus: 'ok',
    });

    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('likely');
    expect(findings[0].message).toContain('Next.js 15.0.3 requires React ^19; found 18.3.1.');
    expect(findings[0].fix).toBe('npm install react@^19 react-dom@^19');
  });

  it('detects Vite 6 with Node 16 as possible severity when runtime is ok', () => {
    const packagesData = [{ name: 'vite', version: '6.0.1' }];
    const findings = runHeuristics({
      packagesData,
      runtimesData: { Node: '16.20.2' },
      runtimesStatus: 'ok',
    });

    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('possible');
    expect(findings[0].message).toContain('Vite 6.0.1 requires Node.js >=18.0.0; found 16.20.2.');
  });

  it('does not produce runtime findings when runtime section is unavailable', () => {
    const packagesData = [{ name: 'vite', version: '6.0.1' }];
    const findings = runHeuristics({
      packagesData,
      runtimesData: { Node: '16.20.2' },
      runtimesStatus: 'unavailable',
    });

    expect(findings.length).toBe(0);
  });

  it('produces no findings when versions satisfy requirements', () => {
    const packagesData = [
      { name: 'next', version: '15.0.3' },
      { name: 'react', version: '19.0.0' },
      { name: 'vite', version: '6.0.1' },
    ];
    const findings = runHeuristics({
      packagesData,
      runtimesData: { Node: '20.18.0' },
      runtimesStatus: 'ok',
    });

    expect(findings.length).toBe(0);
  });
});
