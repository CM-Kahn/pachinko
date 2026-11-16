import RAPIER from '@dimforge/rapier2d-compat';

export type Rapier = typeof RAPIER;

/** Physics runs at a fixed rate regardless of display refresh, so shots are repeatable. */
export const FIXED_DT = 1 / 120;
/** Never try to catch up more than this many steps in one frame (e.g. after a tab switch). */
export const MAX_STEPS_PER_FRAME = 6;

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

/** Loads the Rapier WASM module (once). */
export async function loadRapier(): Promise<Rapier> {
  await RAPIER.init();
  return RAPIER;
}
