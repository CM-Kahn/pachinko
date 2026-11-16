import { describe, expect, it } from 'vitest';
import { DESIGN_H, DESIGN_W, fitCabinet } from './layout';

const VIEWS: [string, number, number][] = [
  ['iPhone portrait', 393, 852],
  ['iPhone landscape', 852, 393],
  ['iPad portrait', 1024, 1366],
  ['Mac window', 1440, 900],
  ['Vision Pro window', 1280, 720],
  ['tiny', 1, 1],
];

describe('fitCabinet', () => {
  it.each(VIEWS)('keeps the whole cabinet on screen and centred: %s', (_name, w, h) => {
    const f = fitCabinet(w, h);
    expect(f.scale).toBeGreaterThan(0);
    expect(f.x).toBeGreaterThanOrEqual(-1e-9);
    expect(f.y).toBeGreaterThanOrEqual(-1e-9);
    expect(f.x + DESIGN_W * f.scale).toBeLessThanOrEqual(w + 1e-9);
    expect(f.y + DESIGN_H * f.scale).toBeLessThanOrEqual(h + 1e-9);
    // Centred: equal space on both sides.
    expect(f.x * 2 + DESIGN_W * f.scale).toBeCloseTo(w);
    expect(f.y * 2 + DESIGN_H * f.scale).toBeCloseTo(h);
  });

  it('touches the limiting edge', () => {
    expect(fitCabinet(900, 3200).scale).toBe(1); // width-limited
    expect(fitCabinet(3000, 800).scale).toBe(0.5); // height-limited
  });

  it('respects the margin', () => {
    const f = fitCabinet(1000, 1700, 50);
    expect(f.scale).toBe(1);
    expect(f.x).toBe(50);
    expect(f.y).toBe(50);
  });
});
