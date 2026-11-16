import { describe, expect, it } from 'vitest';
import { FixedStepper } from './world';

describe('FixedStepper', () => {
  it('runs two 120 Hz steps per 60 Hz frame', () => {
    const s = new FixedStepper();
    expect(s.advance(1 / 60)).toBe(2);
    expect(s.advance(1 / 60)).toBe(2);
  });

  it('carries the remainder between frames', () => {
    const s = new FixedStepper(0.01, 100);
    expect(s.advance(0.015)).toBe(1);
    expect(s.advance(0.015)).toBe(2);
  });

  it('takes the same total steps however time is sliced', () => {
    const a = new FixedStepper();
    const b = new FixedStepper();
    let stepsA = 0;
    let stepsB = 0;
    for (let i = 0; i < 120; i++) stepsA += a.advance(1 / 120);
    for (let i = 0; i < 60; i++) stepsB += b.advance(1 / 60);
    expect(stepsA).toBe(120);
    expect(stepsB).toBe(120);
  });

  it('caps catch-up after a long stall and ignores bad input', () => {
    const s = new FixedStepper(0.01, 5);
    expect(s.advance(10)).toBe(5);
    expect(s.advance(0.01)).toBe(1);
    expect(s.advance(0)).toBe(0);
    expect(s.advance(-1)).toBe(0);
    expect(s.advance(Number.NaN)).toBe(0);
  });
});
