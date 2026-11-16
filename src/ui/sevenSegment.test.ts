import { describe, expect, it } from 'vitest';
import { SEGMENTS, formatCounter, litSegments, segmentPolygon } from './sevenSegment';

describe('litSegments', () => {
  it('lights the right bars for each digit', () => {
    const count = (c: string) => litSegments(c).size;
    expect('0123456789'.split('').map(count)).toEqual([6, 2, 5, 5, 4, 5, 6, 3, 7, 6]);
    expect([...litSegments('1')].sort()).toEqual(['b', 'c']);
    expect([...litSegments('7')].sort()).toEqual(['a', 'b', 'c']);
    expect(litSegments('8').size).toBe(SEGMENTS.length);
  });

  it('is blank for spaces and unknown characters', () => {
    expect(litSegments(' ').size).toBe(0);
    expect(litSegments('x').size).toBe(0);
  });

  it('gives every digit a distinct pattern', () => {
    const patterns = '0123456789'.split('').map((c) => [...litSegments(c)].sort().join(''));
    expect(new Set(patterns).size).toBe(10);
  });
});

describe('formatCounter', () => {
  it('right-aligns with blank leading digits', () => {
    expect(formatCounter(0, 5)).toBe('    0');
    expect(formatCounter(250, 5)).toBe('  250');
    expect(formatCounter(12345, 5)).toBe('12345');
  });

  it('pins instead of wrapping or going negative', () => {
    expect(formatCounter(123456, 5)).toBe('99999');
    expect(formatCounter(-4, 5)).toBe('    0');
    expect(formatCounter(Number.NaN, 3)).toBe('  0');
    expect(formatCounter(7.9, 3)).toBe('  7');
  });
});

describe('segmentPolygon', () => {
  it('keeps every segment inside the digit cell', () => {
    const [w, h, t] = [44, 76, 9];
    for (const seg of SEGMENTS) {
      const pts = segmentPolygon(seg, w, h, t);
      expect(pts).toHaveLength(12);
      for (let i = 0; i < pts.length; i += 2) {
        expect(pts[i]).toBeGreaterThanOrEqual(0);
        expect(pts[i]).toBeLessThanOrEqual(w);
        expect(pts[i + 1]).toBeGreaterThanOrEqual(0);
        expect(pts[i + 1]).toBeLessThanOrEqual(h);
      }
    }
  });
});
