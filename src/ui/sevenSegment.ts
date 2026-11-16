/**
 * Segment logic for the LED counters. Each digit has the classic seven bars (a-g) plus a
 * decimal point, which makes the eight segments of a real display module.
 *
 *    aaa
 *   f   b
 *    ggg
 *   e   c
 *    ddd  .dp
 */
export type Segment = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
export const SEGMENTS: readonly Segment[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

const GLYPHS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  ' ': '',
};

/** Which segments are lit for a character. Unknown characters are blank. */
export function litSegments(char: string): ReadonlySet<Segment> {
  return new Set((GLYPHS[char] ?? '').split('') as Segment[]);
}

/**
 * Text for a counter with a fixed number of digits: right-aligned, leading digits blank,
 * and pinned at all nines rather than wrapping when the value is too big.
 */
export function formatCounter(value: number, digits: number): string {
  const max = 10 ** digits - 1;
  const n = Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : 0;
  return String(n).padStart(digits, ' ');
}

/** Outline of one segment as a flat [x0, y0, x1, y1, ...] polygon in a w-by-h digit cell. */
export function segmentPolygon(seg: Segment, w: number, h: number, t: number): number[] {
  const half = t / 2;
  const gap = t * 0.12;
  const horizontal = (cy: number): number[] => {
    const x0 = half + gap;
    const x1 = w - half - gap;
    return [x0, cy, x0 + half, cy - half, x1 - half, cy - half, x1, cy, x1 - half, cy + half, x0 + half, cy + half];
  };
  const vertical = (cx: number, y0: number, y1: number): number[] => {
    const top = y0 + gap;
    const bottom = y1 - gap;
    return [cx, top, cx + half, top + half, cx + half, bottom - half, cx, bottom, cx - half, bottom - half, cx - half, top + half];
  };
  const mid = h / 2;
  switch (seg) {
    case 'a':
      return horizontal(half);
    case 'g':
      return horizontal(mid);
    case 'd':
      return horizontal(h - half);
    case 'f':
      return vertical(half, half, mid);
    case 'b':
      return vertical(w - half, half, mid);
    case 'e':
      return vertical(half, mid, h - half);
    case 'c':
      return vertical(w - half, mid, h - half);
  }
}
