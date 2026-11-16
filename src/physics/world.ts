import RAPIER from '@dimforge/rapier2d-compat';

/** Physics runs at a fixed rate regardless of display refresh, so shots are repeatable. */
export const FIXED_DT = 1 / 120;
/** Never try to catch up more than this many steps in one frame (e.g. after a tab switch). */
export const MAX_STEPS_PER_FRAME = 8;

/** Turns variable frame times into a whole number of fixed steps, carrying the remainder. */
export class FixedStepper {
  private accumulator = 0;

  constructor(
    readonly dt = FIXED_DT,
    readonly maxSteps = MAX_STEPS_PER_FRAME,
  ) {}

  /** Returns how many fixed steps to run for a frame that took `elapsed` seconds. */
  advance(elapsed: number): number {
    if (!(elapsed > 0)) return 0;
    this.accumulator += elapsed;
    let steps = Math.floor(this.accumulator / this.dt + 1e-9);
    if (steps > this.maxSteps) {
      // Too far behind: drop the backlog rather than spiral.
      steps = this.maxSteps;
      this.accumulator = 0;
    } else {
      this.accumulator = Math.max(0, this.accumulator - steps * this.dt);
    }
    return steps;
  }
}

export interface Physics {
  readonly world: RAPIER.World;
  /** Advance the simulation by a frame's worth of real time; returns steps taken. */
  update(elapsedSeconds: number): number;
}

/** Loads the Rapier WASM module and creates an empty world. The board arrives in Phase 2. */
export async function createPhysics(): Promise<Physics> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: 9.81 });
  world.timestep = FIXED_DT;
  const stepper = new FixedStepper();
  return {
    world,
    update(elapsedSeconds) {
      const steps = stepper.advance(elapsedSeconds);
      for (let i = 0; i < steps; i++) world.step();
      return steps;
    },
  };
}
