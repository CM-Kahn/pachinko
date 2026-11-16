import { describe, expect, it } from 'vitest';
import classic from './classic.json';
import { angleOf, loadBoard, polar } from './loader';
import type { BoardSpec } from './types';

const base: BoardSpec = {
  name: 'Test',
  radius: 400,
  ballRadius: 11,
  pinRadius: 4,
  rail: { r: 368, from: 106, to: 250 },
  launch: { angle: 128, r: 387, minSpeed: 1700, maxSpeed: 2100 },
  bumpers: [{ angle: 322, r: 388, radius: 15 }],
  drain: { x: 0, y: 386, halfWidth: 34, halfHeight: 20 },
  display: { x: 0, y: -71, halfWidth: 96, halfHeight: 63 },
  pockets: [],
  pins: [],
};

describe('loadBoard', () => {
  it('expands pins, lines and arcs, mirroring when asked', () => {
    const b = loadBoard({
      ...base,
      pins: [
        { type: 'pin', x: 10, y: 20, mirror: true },
        { type: 'line', x1: 0, y1: 0, x2: 0, y2: 30, n: 4 },
        { type: 'arc', cx: 100, cy: 0, r: 50, from: 180, to: 270, n: 3 },
      ],
    });
    const has = (x: number, y: number) => b.pins.some((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6);
    expect(b.pins).toHaveLength(2 + 4 + 3);
    expect(has(10, 20) && has(-10, 20)).toBe(true);
    expect(has(0, 0) && has(0, 10) && has(0, 20) && has(0, 30)).toBe(true);
    expect(has(50, 0) && has(100, -50)).toBe(true);
  });

  it('does not duplicate a mirrored pin on the centre line', () => {
    const b = loadBoard({ ...base, pins: [{ type: 'line', x1: 0, y1: -50, x2: 40, y2: -10, n: 5, mirror: true }] });
    expect(b.pins).toHaveLength(9);
  });

  it('fills a symmetric field that respects keep-out zones and clearance', () => {
    const b = loadBoard({
      ...base,
      pins: [
        { type: 'pin', x: 100, y: 0 },
        { type: 'field', yFrom: -100, yTo: 100, dx: 50, dy: 50, maxR: 200, clearance: 40, exclude: [{ x: -30, y: -30, w: 60, h: 60 }, { cx: -100, cy: 0, r: 20 }] },
      ],
    });
    const fieldPins = b.pins.filter((p) => !(p.x === 100 && p.y === 0));
    expect(fieldPins.length).toBeGreaterThan(10);
    for (const p of fieldPins) {
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(200);
      expect(Math.hypot(p.x - 100, p.y)).toBeGreaterThanOrEqual(40);
      expect(Math.abs(p.x) < 30 && Math.abs(p.y) < 30).toBe(false);
    }
    // Symmetric apart from the pins removed around the one-sided extras.
    const farFromExtras = fieldPins.filter((p) => Math.abs(Math.abs(p.x) - 100) > 45 || Math.abs(p.y) > 45);
    for (const p of farFromExtras) {
      expect(fieldPins.some((q) => Math.abs(q.x + p.x) < 1e-6 && q.y === p.y)).toBe(true);
    }
  });

  it('rejects pins outside the playfield', () => {
    expect(() => loadBoard({ ...base, pins: [{ type: 'pin', x: 399, y: 0 }] })).toThrow(/outside/);
  });

  it('launches up the left side', () => {
    const b = loadBoard(base);
    expect(b.launch.x).toBeLessThan(0);
    expect(b.launch.y).toBeGreaterThan(0);
    expect(b.launch.dirX).toBeLessThan(0);
    expect(b.launch.dirY).toBeLessThan(0);
    expect(Math.hypot(b.launch.dirX, b.launch.dirY)).toBeCloseTo(1);
  });

  it('measures angles the way the board files describe them', () => {
    expect(angleOf(1, 0)).toBeCloseTo(0);
    expect(angleOf(0, 1)).toBeCloseTo(90);
    expect(angleOf(-1, 0)).toBeCloseTo(180);
    expect(angleOf(0, -1)).toBeCloseTo(270);
    const p = polar(270, 10);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(-10);
  });
});

describe('the Classic board', () => {
  const board = loadBoard(classic as BoardSpec);

  it('has a healthy pin field', () => {
    expect(board.pins.length).toBeGreaterThan(150);
  });

  it('is left-right symmetric', () => {
    for (const p of board.pins) {
      expect(board.pins.some((q) => Math.abs(q.x + p.x) < 0.01 && Math.abs(q.y - p.y) < 0.01)).toBe(true);
    }
  });

  it('never leaves a gap a ball could jam in', () => {
    // Between any two pins a ball either passes with room to spare or clearly cannot enter.
    const d = board.ballRadius * 2;
    for (let i = 0; i < board.pins.length; i++) {
      for (let j = i + 1; j < board.pins.length; j++) {
        const a = board.pins[i]!;
        const b = board.pins[j]!;
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - board.pinRadius * 2;
        // Ignore pairs with another pin sitting between them (e.g. along a dense row).
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const reach = Math.hypot(a.x - b.x, a.y - b.y) / 2;
        if (board.pins.some((c) => c !== a && c !== b && Math.hypot(c.x - mx, c.y - my) < reach)) continue;
        expect(gap < d * 0.6 || gap > d * 1.15, `gap ${gap.toFixed(1)} between ${a.x},${a.y} and ${b.x},${b.y}`).toBe(true);
      }
    }
  });
});
