import { beforeAll, describe, expect, it } from 'vitest';
import classic from '../board/classic.json';
import { loadBoard } from '../board/loader';
import type { BoardSpec } from '../board/types';
import { Simulation, type Ball } from './sim';
import { FIXED_DT, loadRapier, type Rapier } from './world';

const board = loadBoard(classic as BoardSpec);
let R: Rapier;
beforeAll(async () => {
  R = await loadRapier();
});

function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Fire one ball and run until it drains. */
function shoot(power: number, random: () => number = () => 0.5): { ball: Ball; seconds: number; path: Ball['x'][] } {
  const sim = new Simulation(R, board, random);
  const ball = sim.launch(power)!;
  let drained = false;
  let steps = 0;
  const path: number[] = [];
  while (!drained && steps < 120 * 60) {
    sim.step({ onDrain: () => (drained = true) });
    path.push(ball.x, ball.y);
    steps++;
  }
  expect(drained).toBe(true);
  return { ball, seconds: steps * FIXED_DT, path };
}

describe('Simulation', () => {
  it('lets a weak shot fall back down the lane without entering the field', () => {
    const { ball, seconds } = shoot(0);
    expect(ball.entered).toBe(false);
    expect(seconds).toBeLessThan(5);
  });

  it('sends medium and strong shots into the field', () => {
    for (const power of [0.3, 0.5, 0.7, 0.9, 1]) {
      expect(shoot(power).ball.entered).toBe(true);
    }
  });

  it('repeats exactly for the same pull', () => {
    const a = shoot(0.55);
    const b = shoot(0.55);
    expect(a.path).toEqual(b.path);
  });

  it('carries more speed into the field the harder the pull', () => {
    const entrySpeed = (power: number): number => {
      const sim = new Simulation(R, board, () => 0.5);
      const ball = sim.launch(power)!;
      for (let i = 0; i < 120 * 10 && !ball.entered; i++) sim.step();
      const v = ball.body!.linvel();
      return Math.hypot(v.x, v.y);
    };
    const speeds = [0.2, 0.4, 0.6, 0.8, 1].map(entrySpeed);
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]!).toBeGreaterThan(speeds[i - 1]!);
  });

  it('plays a long stream with every ball staying on the board and draining promptly', () => {
    const random = seeded(7);
    const sim = new Simulation(R, board, random);
    const born = new Map<number, number>();
    let launched = 0;
    let drained = 0;
    let hits = 0;
    let longest = 0;
    let peak = 0;
    let step = 0;
    while ((launched < 400 || sim.balls.length > 0) && step < 120 * 600) {
      if (launched < 400 && step % 40 === 0) {
        const b = sim.launch(0.15 + random() * 0.85);
        if (b) {
          launched++;
          born.set(b.id, step);
        }
      }
      sim.step({
        onHit: () => hits++,
        onDrain: (b) => {
          drained++;
          longest = Math.max(longest, (step - born.get(b.id)!) * FIXED_DT);
        },
      });
      for (const b of sim.balls) expect(Math.hypot(b.x, b.y)).toBeLessThan(board.radius);
      peak = Math.max(peak, sim.balls.length);
      step++;
    }
    expect(drained).toBe(400);
    expect(sim.balls).toHaveLength(0);
    expect(longest).toBeLessThan(20);
    // A ball should rattle off plenty of pins on the way down.
    expect(hits / launched).toBeGreaterThan(10);
    expect(peak).toBeGreaterThan(8);
  });

  it('simulates 60 balls well inside a 60 fps frame', () => {
    const random = seeded(3);
    const sim = new Simulation(R, board, random);
    const top = (): void => {
      while (sim.balls.length < 60) sim.spawn(-250 + random() * 500, -300 + random() * 60, 0, 0);
    };
    for (let i = 0; i < 240; i++) {
      top();
      sim.step();
    }
    const t0 = performance.now();
    const steps = 600;
    for (let i = 0; i < steps; i++) {
      top();
      sim.step();
    }
    const msPerStep = (performance.now() - t0) / steps;
    // Two steps per frame must leave nearly all of the 16.7 ms for drawing, even on a phone.
    expect(msPerStep).toBeLessThan(2);
  });

  it('refuses to launch into a blocked lane and clears on request', () => {
    const sim = new Simulation(R, board);
    expect(sim.launch(0.5)).not.toBeNull();
    expect(sim.canLaunch()).toBe(false);
    expect(sim.launch(0.5)).toBeNull();
    for (let i = 0; i < 12; i++) sim.step();
    expect(sim.canLaunch()).toBe(true);
    sim.clear();
    expect(sim.balls).toHaveLength(0);
  });
});
