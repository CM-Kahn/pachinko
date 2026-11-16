import { FillGradient } from 'pixi.js';
import { CHROME_STOPS } from '../theme';

/** A chrome fill, banded top-to-bottom or on the diagonal. */
export function chrome(vertical = true): FillGradient {
  return new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: vertical ? { x: 0, y: 1 } : { x: 1, y: 1 },
    colorStops: CHROME_STOPS,
    textureSpace: 'local',
  });
}

/** Small deterministic random source so decoration is identical on every load. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
