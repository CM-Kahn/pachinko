import { describe, expect, it } from 'vitest';
import { AUTO_FIRE_DELAY, AUTO_FIRE_PERIOD, LauncherLogic } from './launcher';

const DT = 1 / 120;
function run(l: LauncherLogic, seconds: number): number[] {
  const shots: number[] = [];
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    const s = l.update(DT);
    if (s !== null) shots.push(s);
  }
  return shots;
}

describe('LauncherLogic', () => {
  it('flicks one ball on a quick pull and release', () => {
    const l = new LauncherLogic();
    l.grab();
    l.setPull(0.6);
    expect(run(l, AUTO_FIRE_DELAY / 2)).toEqual([]);
    expect(l.release()).toBe(0.6);
    expect(l.pull).toBe(0);
    expect(run(l, 2)).toEqual([]);
  });

  it('fires a steady stream while held, with no extra shot on release', () => {
    const l = new LauncherLogic();
    l.grab();
    l.setPull(0.5);
    const shots = run(l, AUTO_FIRE_DELAY + AUTO_FIRE_PERIOD * 4 + 0.05);
    expect(shots).toEqual([0.5, 0.5, 0.5, 0.5, 0.5]);
    expect(l.release()).toBeNull();
  });

  it('uses the current pull for each shot in a stream', () => {
    const l = new LauncherLogic();
    l.grab();
    l.setPull(0.3);
    const first = run(l, AUTO_FIRE_DELAY + 0.05);
    l.setPull(0.8);
    const second = run(l, AUTO_FIRE_PERIOD);
    expect(first).toEqual([0.3]);
    expect(second).toEqual([0.8]);
  });

  it('ignores taps and tiny pulls', () => {
    const l = new LauncherLogic();
    l.grab();
    expect(l.release()).toBeNull();
    l.grab();
    l.setPull(0.01);
    expect(run(l, 2)).toEqual([]);
    expect(l.release()).toBeNull();
  });

  it('clamps the pull and ignores input when not held', () => {
    const l = new LauncherLogic();
    l.setPull(0.9);
    expect(l.pull).toBe(0);
    l.grab();
    l.setPull(7);
    expect(l.pull).toBe(1);
    l.setPull(-3);
    expect(l.pull).toBe(0);
  });
});
