/**
 * How the launch handle behaves, separate from how it looks.
 *
 * Just like an old machine from Japan: pull the handle back and let go to shoot one ball.
 * One pull, one ball. How far you pull sets how hard it is struck.
 */

/** Pulls smaller than this don't fire: stops accidental taps wasting balls. */
export const MIN_PULL = 0.05;

export class LauncherLogic {
  /** How far the handle is pulled back, 0 to 1. */
  pull = 0;
  held = false;

  grab(): void {
    this.held = true;
    this.pull = 0;
  }

  setPull(pull: number): void {
    if (this.held) this.pull = Math.min(1, Math.max(0, pull));
  }

  /** Let go of the handle. Returns the power of the shot, or null if nothing fires. */
  release(): number | null {
    if (!this.held) return null;
    const power = this.pull;
    this.held = false;
    this.pull = 0;
    return power >= MIN_PULL ? power : null;
  }

  /** Let go without shooting (e.g. the page was hidden mid-pull). */
  cancel(): void {
    this.held = false;
    this.pull = 0;
  }
}
