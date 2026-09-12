import { describe, it, expect } from 'vitest';
import { decodeVlq, decodeVlqSegment } from './vlq.js';

describe('VLQ decoder (PMP-44)', () => {
  it('decodes AAAA to [0, 0, 0, 0]', () => {
    expect(decodeVlq('AAAA')).toEqual([0, 0, 0, 0]);
  });

  it('decodes positive numbers with continuation bits', () => {
    // In Base64 VLQ:
    // 'mH' encodes 115
    // '2H' encodes 123
    expect(decodeVlq('mH')).toEqual([115]);
    expect(decodeVlq('2H')).toEqual([123]);
  });

  it('decodes negative numbers', () => {
    // 'D' is -1
    // 'nH' is -115
    expect(decodeVlq('D')).toEqual([-1]);
    expect(decodeVlq('nH')).toEqual([-115]);
  });

  it('decodes single character integers', () => {
    expect(decodeVlq('A')).toEqual([0]);
    expect(decodeVlq('C')).toEqual([1]);
    expect(decodeVlq('D')).toEqual([-1]);
  });

  it('decodeVlqSegment returns decoded values and parsed length', () => {
    const { values, length } = decodeVlqSegment('AAAA;next', 0);
    expect(values).toEqual([0, 0, 0, 0]);
    expect(length).toBe(4);
  });

  it('handles empty or malformed strings gracefully', () => {
    expect(decodeVlq('')).toEqual([]);
    expect(decodeVlq('!@#$%')).toEqual([]);
  });
});
