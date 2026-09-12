import { describe, it, expect } from 'vitest';
import { satisfies, parseSemver } from './semver.js';

describe('semver satisfies', () => {
  it('parses semver versions correctly', () => {
    expect(parseSemver('15.0.3')).toEqual([15, 0, 3]);
    expect(parseSemver('v18.3.1')).toEqual([18, 3, 1]);
    expect(parseSemver('^19.0.0')).toEqual([19, 0, 0]);
    expect(parseSemver('6')).toEqual([6, 0, 0]);
  });

  it('evaluates caret ranges correctly', () => {
    expect(satisfies('19.0.0', '^19')).toBe(true);
    expect(satisfies('19.1.5', '^19.0.0')).toBe(true);
    expect(satisfies('18.3.1', '^19')).toBe(false);
    expect(satisfies('20.0.0', '^19')).toBe(false);
  });

  it('evaluates tilde ranges correctly', () => {
    expect(satisfies('18.2.3', '~18.2.0')).toBe(true);
    expect(satisfies('18.3.0', '~18.2.0')).toBe(false);
  });

  it('evaluates inequality operators', () => {
    expect(satisfies('20.18.0', '>=18')).toBe(true);
    expect(satisfies('16.20.0', '>=18')).toBe(false);
    expect(satisfies('18.0.0', '>=18')).toBe(true);
    expect(satisfies('17.9.9', '<18')).toBe(true);
    expect(satisfies('18.0.0', '<18')).toBe(false);
  });

  it('evaluates wildcards', () => {
    expect(satisfies('5.4.1', '5.x')).toBe(true);
    expect(satisfies('6.0.0', '5.x')).toBe(false);
  });

  it('evaluates combined ranges with AND and OR', () => {
    expect(satisfies('5.5.0', '>=5.4.0 <5.6.0')).toBe(true);
    expect(satisfies('5.6.0', '>=5.4.0 <5.6.0')).toBe(false);
    expect(satisfies('18.3.1', '^18.0.0 || ^19.0.0')).toBe(true);
    expect(satisfies('17.0.0', '^18.0.0 || ^19.0.0')).toBe(false);
  });
});
