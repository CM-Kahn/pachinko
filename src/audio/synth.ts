/**
 * Every sound in the game is made here from scratch, as plain arrays of samples. Nothing is
 * sampled or downloaded. Each function models how the real object rings: a struck thing is a
 * handful of decaying tones (its "modes") plus the click of the impact itself.
 *
 * These functions know nothing about the browser's audio system, so they can be tested.
 */

/** One ringing mode of a struck object. */
export interface Mode {
  /** Frequency in Hz. */
  f: number;
  /** Time in seconds for the mode to fall to about a third of its starting level. */
  decay: number;
  amp: number;
}

/** Small repeatable random source, so a given sound is identical on every device. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Scale so the loudest sample sits at `peak`. */
export function normalise(data: Float32Array, peak = 0.9): Float32Array {
  let max = 0;
  for (const v of data) max = Math.max(max, Math.abs(v));
  if (max > 0) for (let i = 0; i < data.length; i++) data[i] = (data[i]! / max) * peak;
  return data;
}

/** Fade the last few milliseconds to nothing so a sound never ends with a click. */
function fadeOut(data: Float32Array, sr: number, seconds = 0.004): Float32Array {
  const n = Math.min(data.length, Math.floor(seconds * sr));
  for (let i = 0; i < n; i++) data[data.length - 1 - i]! *= i / n;
  return data;
}

interface StrikeOptions {
  /** Level and decay of the noise click at the moment of impact. */
  click?: number;
  clickDecay?: number;
  seed?: number;
  /** Length in seconds; by default long enough for the slowest mode to die away. */
  seconds?: number;
}

/** A struck object: decaying modes plus an impact click. */
export function strike(sr: number, modes: Mode[], options: StrikeOptions = {}): Float32Array {
  const { click = 0, clickDecay = 0.001, seed = 1 } = options;
  const longest = modes.reduce((m, p) => Math.max(m, p.decay), clickDecay);
  const seconds = options.seconds ?? longest * 6;
  const n = Math.max(8, Math.floor(seconds * sr));
  const out = new Float32Array(n);
  const noise = rng(seed);
  for (const m of modes) {
    // Modes above what the sample rate can carry are left out.
    if (m.f >= sr * 0.45) continue;
    const w = (2 * Math.PI * m.f) / sr;
    const k = Math.exp(-1 / (m.decay * sr));
    let env = m.amp;
    for (let i = 0; i < n; i++) {
      out[i]! += Math.sin(w * i) * env;
      env *= k;
    }
  }
  if (click > 0) {
    const k = Math.exp(-1 / (clickDecay * sr));
    let env = click;
    for (let i = 0; i < n && env > 1e-4; i++) {
      out[i]! += (noise() * 2 - 1) * env;
      env *= k;
    }
  }
  return fadeOut(normalise(out), sr);
}

/** Add `source` into `target` starting at `at` seconds, scaled by `gain`. */
function mixInto(target: Float32Array, source: Float32Array, sr: number, at: number, gain: number): void {
  const start = Math.floor(at * sr);
  for (let i = 0; i < source.length && start + i < target.length; i++) target[start + i]! += source[i]! * gain;
}

/** A steel ball on a brass pin set in wood: a bright "tink" over a tiny woody knock. */
export function pinTick(sr: number, variant: number): Float32Array {
  const r = rng(101 + variant * 17);
  const f = 3500 + r() * 1700;
  return strike(
    sr,
    [
      { f, decay: 0.024 + r() * 0.01, amp: 1 },
      { f: f * (1.48 + r() * 0.08), decay: 0.017, amp: 0.6 },
      { f: f * (2.27 + r() * 0.1), decay: 0.011, amp: 0.36 },
      { f: f * (3.1 + r() * 0.15), decay: 0.007, amp: 0.2 },
      // The board the pin stands in.
      { f: 680 + r() * 320, decay: 0.006, amp: 0.45 },
    ],
    { click: 0.4, clickDecay: 0.0007, seed: 7 + variant },
  );
}

/** Two steel balls meeting: a short, hard, high "tik". */
export function ballClick(sr: number, variant: number): Float32Array {
  const r = rng(301 + variant * 13);
  const f = 5800 + r() * 1400;
  return strike(
    sr,
    [
      { f, decay: 0.01, amp: 1 },
      { f: f * 1.53, decay: 0.007, amp: 0.6 },
      { f: f * 2.12, decay: 0.004, amp: 0.3 },
    ],
    { click: 0.55, clickDecay: 0.0005, seed: 31 + variant },
  );
}

/** A ball against the steel guide rail or the rim: a lower, longer ring. */
export function railTap(sr: number, variant: number): Float32Array {
  const r = rng(401 + variant * 11);
  const f = 1700 + r() * 500;
  return strike(
    sr,
    [
      { f, decay: 0.032, amp: 1 },
      { f: f * 1.62, decay: 0.022, amp: 0.5 },
      { f: f * 2.45, decay: 0.012, amp: 0.3 },
      { f: 230, decay: 0.01, amp: 0.4 },
    ],
    { click: 0.35, clickDecay: 0.001, seed: 41 + variant },
  );
}

/** A ball on moulded plastic (a tulip petal, a windmill vane, the tiger): a dull "tock". */
export function plasticTock(sr: number, variant: number): Float32Array {
  const r = rng(501 + variant * 7);
  const f = 480 + r() * 180;
  return strike(
    sr,
    [
      { f, decay: 0.011, amp: 1 },
      { f: f * 1.9, decay: 0.008, amp: 0.6 },
      { f: f * 3.2, decay: 0.005, amp: 0.35 },
    ],
    { click: 0.6, clickDecay: 0.0018, seed: 51 + variant },
  );
}

/** The rubber stopper at the top of the board: a soft thud. */
export function rubberThud(sr: number): Float32Array {
  return strike(
    sr,
    [
      { f: 165, decay: 0.045, amp: 1 },
      { f: 250, decay: 0.028, amp: 0.5 },
      { f: 610, decay: 0.008, amp: 0.25 },
    ],
    { click: 0.25, clickDecay: 0.003, seed: 61 },
  );
}

/** The payout bell: a small struck bell, bright and clear. */
export function bell(sr: number): Float32Array {
  const f = 2350;
  return strike(
    sr,
    [
      { f: f * 0.5, decay: 0.5, amp: 0.22 },
      { f, decay: 0.42, amp: 1 },
      { f: f * 2.76, decay: 0.22, amp: 0.5 },
      { f: f * 5.4, decay: 0.11, amp: 0.28 },
      { f: f * 8.93, decay: 0.05, amp: 0.14 },
    ],
    { click: 0.3, clickDecay: 0.0012, seed: 71, seconds: 1.6 },
  );
}

/** A won ball landing among the others in the steel tray. */
export function trayChink(sr: number, variant: number): Float32Array {
  const r = rng(801 + variant * 19);
  const f = 3000 + r() * 2200;
  return strike(
    sr,
    [
      { f, decay: 0.02, amp: 1 },
      { f: f * (1.7 + r() * 0.3), decay: 0.012, amp: 0.55 },
      { f: f * (2.6 + r() * 0.3), decay: 0.007, amp: 0.3 },
      // The tray itself.
      { f: 380 + r() * 90, decay: 0.035, amp: 0.3 },
    ],
    { click: 0.45, clickDecay: 0.0008, seed: 81 + variant },
  );
}

/** A plastic petal snapping against its stop: two clicks a few milliseconds apart. */
export function snap(sr: number, open: boolean): Float32Array {
  const f = open ? 1150 : 820;
  const one = strike(
    sr,
    [
      { f, decay: 0.008, amp: 1 },
      { f: f * 2.3, decay: 0.005, amp: 0.5 },
      { f: f * 0.5, decay: 0.012, amp: 0.4 },
    ],
    { click: 0.8, clickDecay: 0.0015, seed: open ? 91 : 92 },
  );
  const out = new Float32Array(Math.floor(sr * 0.09));
  mixInto(out, one, sr, 0, 1);
  mixInto(out, one, sr, 0.016, 0.45);
  return fadeOut(normalise(out), sr);
}

/** The launcher: a spring-loaded hammer strikes the ball. A clack, a thump and a spring's shiver. */
export function hammer(sr: number): Float32Array {
  const n = Math.floor(sr * 0.32);
  const out = new Float32Array(n);
  const noise = rng(111);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const clack = (noise() * 2 - 1) * Math.exp(-t / 0.0035) * 0.9;
    const thump = Math.sin(2 * Math.PI * (70 * t + 4.5 * (1 - Math.exp(-t / 0.05)))) * Math.exp(-t / 0.045);
    const spring = Math.sin(2 * Math.PI * 312 * t + 2.2 * Math.sin(2 * Math.PI * 41 * t)) * Math.exp(-t / 0.11) * 0.22;
    const ring = Math.sin(2 * Math.PI * 2380 * t) * Math.exp(-t / 0.014) * 0.3;
    out[i] = clack + thump + spring + ring;
  }
  return fadeOut(normalise(out), sr);
}

/** A ball running up the steel launch rail: a brief rolling rush. */
export function railRun(sr: number): Float32Array {
  const n = Math.floor(sr * 0.5);
  const out = new Float32Array(n);
  const noise = rng(121);
  let low = 0;
  let band = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // Noise kept to a band around 2 to 3 kHz, like steel rolling on steel.
    const x = noise() * 2 - 1;
    low += 0.35 * (x - low);
    band += 0.08 * (low - band);
    const rolling = 0.65 + 0.35 * Math.sin(2 * Math.PI * (30 - 12 * t) * t);
    const envelope = Math.min(1, t / 0.03) * Math.exp(-t / 0.16);
    out[i] = (low - band) * rolling * envelope;
  }
  return fadeOut(normalise(out, 0.7), sr, 0.02);
}

/** A ball dropping into the out hole: a dull knock, then it rattles away below. */
export function drainDrop(sr: number): Float32Array {
  const out = new Float32Array(Math.floor(sr * 0.3));
  const knock = strike(
    sr,
    [
      { f: 170, decay: 0.04, amp: 1 },
      { f: 310, decay: 0.02, amp: 0.5 },
      { f: 900, decay: 0.006, amp: 0.3 },
    ],
    { click: 0.3, clickDecay: 0.002, seed: 131 },
  );
  const rattle = plasticTock(sr, 3);
  mixInto(out, knock, sr, 0, 1);
  mixInto(out, rattle, sr, 0.085, 0.22);
  mixInto(out, rattle, sr, 0.15, 0.12);
  mixInto(out, rattle, sr, 0.2, 0.06);
  return fadeOut(normalise(out, 0.8), sr);
}

/** How many different versions of each repeated sound are made, so streams never sound stamped out. */
export const VARIANTS = { pin: 8, ball: 4, rail: 4, plastic: 5, tray: 8 } as const;

/** Impacts slower than this (board units per second) are silent. */
export const QUIET_SPEED = 55;
export const LOUD_SPEED = 1500;

/** How hard an impact is, from 0 (barely audible) to 1 (as hard as they come). */
export function impactForce(speed: number): number {
  return Math.min(1, Math.max(0, (speed - QUIET_SPEED) / (LOUD_SPEED - QUIET_SPEED)));
}

/** Loudness of an impact: gentle taps are quiet, hard ones stand out. */
export function impactGain(speed: number): number {
  const force = impactForce(speed);
  return force <= 0 ? 0 : 0.05 + 0.85 * Math.pow(force, 1.5);
}

/**
 * Keeps dense clatter pleasant: at most `maxVoices` impact sounds at once, never two closer
 * together than `minGap`, and when things are busy only the louder impacts get through.
 */
export class VoiceGate {
  private readonly ends: number[] = [];
  private last = -Infinity;

  constructor(
    readonly maxVoices = 18,
    readonly minGap = 0.006,
  ) {}

  /** Should a sound of this loudness and length start at time `now` (seconds)? */
  admit(now: number, gain: number, seconds: number): boolean {
    if (gain <= 0 || now - this.last < this.minGap) return false;
    for (let i = this.ends.length - 1; i >= 0; i--) if (this.ends[i]! <= now) this.ends.splice(i, 1);
    const busy = this.ends.length / this.maxVoices;
    if (busy >= 1) return false;
    // Past half full, quiet impacts are dropped first.
    if (busy > 0.5 && gain < (busy - 0.5) * 0.8) return false;
    this.ends.push(now + seconds);
    this.last = now;
    return true;
  }

  get active(): number {
    return this.ends.length;
  }
}
