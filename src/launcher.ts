/**
 * How the launch handle behaves, separate from how it looks.
 *
 * Pull the handle back and let go to flick one ball, like the old machines. Keep holding it
 * back and it fires a steady stream at that power, so you can find the sweet spot and stay
 * on it.
 */
export const AUTO_FIRE_DELAY = 0.3;
export const AUTO_FIRE_PERIOD = 0.4;
/** Pulls smaller than this don't fire: stops accidental taps wasting balls. */
export const MIN_PULL = 0.05;

export class LauncherLogic {
  /** How far the handle is pulled back, 0 to 1. */
  pull = 0;
  held = false;
  private timer = 0;
  private firedThisGrab = false;

  grab(): void {
    this.held = true;
    this.pull = 0;
    this.timer = AUTO_FIRE_DELAY;
    this.firedThisGrab = false;
  }

  setPull(pull: number): void {
    if (this.held) this.pull = Math.min(1, Math.max(0, pull));
  }

  /** Let go of the handle. Returns the power of a flick shot, or null if nothing fires. */
  release(): number | null {
    if (!this.held) return null;
    const power = this.pull;
    const flick = !this.firedThisGrab && power >= MIN_PULL;
    this.held = false;
    this.pull = 0;
    return flick ? power : null;
  }

  /** Advance time. Returns the power of a shot to fire now, or null. */
  update(dt: number): number | null {
    if (!this.held || this.pull < MIN_PULL) return null;
    this.timer -= dt;
    if (this.timer > 0) return null;
    this.timer += AUTO_FIRE_PERIOD;
    if (this.timer <= 0) this.timer = AUTO_FIRE_PERIOD;
    this.firedThisGrab = true;
    return this.pull;
  }
}
