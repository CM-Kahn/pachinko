import RAPIER from '@dimforge/rapier2d-compat';
import { describe, expect, it } from 'vitest';
import { FIXED_DT, FixedStepper, createPhysics } from './world';

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

describe('createPhysics', () => {
  it('loads Rapier and simulates a falling ball', async () => {
    const physics = await createPhysics();
    const body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0));
    physics.world.createCollider(RAPIER.ColliderDesc.ball(0.1), body);
    let steps = 0;
    for (let i = 0; i < 60; i++) steps += physics.update(1 / 60);
    expect(steps).toBe(120);
    expect(physics.world.timestep).toBeCloseTo(FIXED_DT);
    // One second of free fall: about g/2 metres down (y points down the board).
    expect(body.translation().y).toBeGreaterThan(4.5);
    expect(body.translation().y).toBeLessThan(5.3);
  });
});
