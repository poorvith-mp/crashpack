import { describe, it, expect } from 'vitest';
import { runHeuristics, Finding } from './index.js';
import { CrashPack } from '../types.js';

describe('Heuristics engine', () => {
  it('does not impose a blanket React 19 requirement on Next 15', () => {
    const packagesData = [
      { name: 'next', version: '15.0.3' },
      { name: 'react', version: '18.3.1' },
    ];
    const findings = runHeuristics({
      packagesData,
      runtimesData: { Node: '20.18.0' },
      runtimesStatus: 'ok',
    });

    // Published Next 15 peers allow React 18; router-specific inference is absent.
    expect(findings).toEqual([]);
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

describe('installed compatibility evidence', () => {
  it.each([
    ['20.18.0', 1], ['20.19.0', 0], ['21.0.0', 1],
    ['22.0.0', 1], ['22.11.0', 1], ['22.12.0', 0], ['24.0.0', 0],
  ])('evaluates the Vite 7 Node boundary at %s', (Node, count) => {
    expect(runHeuristics({ packagesData: [{ name: 'vite', version: '7.0.0' }], runtimesData: { Node }, runtimesStatus: 'ok' })).toHaveLength(count);
  });

  it.each(['^6.0.1', '~6.0.1', 'latest', 'workspace:*', 'https://example.test/vite.tgz', '6.0.1-beta.1', '>=6.0.1'])('does not diagnose a declaration or unsupported version %s', (version) => {
    expect(runHeuristics({ packagesData: [{ name: 'vite', version }], runtimesData: { Node: '16.20.2' }, runtimesStatus: 'ok' })).toEqual([]);
  });

  it('does not diagnose an exact version marked declared', () => {
    const packagesData = [{ name: 'vite', version: '6.0.1', versionSource: 'declared' as const }];
    expect(runHeuristics({ packagesData, runtimesData: { Node: '16.20.2' }, runtimesStatus: 'ok' })).toEqual([]);
  });

  it('keeps stable installed and legacy caller-supplied evidence working', () => {
    for (const packagesData of [[{ name: 'vite', version: '6.0.1', versionSource: 'installed' as const }], [{ name: 'vite', version: '6.0.1' }]]) {
      expect(runHeuristics({ packagesData, runtimesData: { Node: '16.20.2' }, runtimesStatus: 'ok' })).toHaveLength(1);
    }
  });

  it.each(['unknown', '22.0.0-beta.1'])('does not diagnose an unknown or unsupported runtime %s', (Node) => {
    expect(runHeuristics({ packagesData: [{ name: 'vite', version: '7.0.0' }], runtimesData: { Node }, runtimesStatus: 'ok' })).toEqual([]);
  });

  it('retains unrelated Next 14 / React 17 diagnosis', () => {
    expect(runHeuristics({ packagesData: [{ name: 'next', version: '14.0.0' }, { name: 'react', version: '17.0.0' }] })).toHaveLength(1);
  });
});
