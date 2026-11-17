import type { HitKind } from '../physics/sim';

/**
 * First-pass sound: everything is synthesised here, nothing is sampled or downloaded.
 * The full sound set arrives in Phase 4; this is enough to tune the physics by ear.
 */

/** Dense clatter stays pleasant if ticks can't pile up closer together than this. */
const MIN_TICK_GAP = 0.014;
/** Impacts slower than this (board units/s) are silent. */
const QUIET_SPEED = 60;
const LOUD_SPEED = 1500;

type AudioCtor = typeof AudioContext;

function render(ctx: AudioContext, seconds: number, fn: (t: number, i: number) => number): AudioBuffer {
  const n = Math.max(1, Math.floor(seconds * ctx.sampleRate));
  const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = fn(i / ctx.sampleRate, i);
  return buffer;
}

/** A struck-metal ping: a few inharmonic partials with a fast decay and a click on the front. */
function ping(ctx: AudioContext, partials: number[], decay: number, click: number): AudioBuffer {
  let seed = 12345 + Math.round(partials[0] ?? 0);
  const noise = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  return render(ctx, decay * 7, (t) => {
    let s = 0;
    partials.forEach((f, k) => {
      s += (Math.sin(2 * Math.PI * f * t) * Math.exp(-t / (decay / (1 + k * 0.6)))) / (1 + k);
    });
    s += noise() * click * Math.exp(-t / 0.0015);
    return s * 0.6;
  });
}

export class Sound {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private pins: AudioBuffer[] = [];
  private wall: AudioBuffer | null = null;
  private thunk: AudioBuffer | null = null;
  private drop: AudioBuffer | null = null;
  private bell: AudioBuffer | null = null;
  private lastCoin = 0;
  private lastTick = 0;
  private _muted = false;

  get muted(): boolean {
    return this._muted;
  }

  set muted(value: boolean) {
    this._muted = value;
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(value ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  /**
   * Browsers (iOS Safari above all) keep audio locked until the player touches the page.
   * Call this from every touch, click and key press; it is cheap once sound is running.
   */
  unlock(): void {
    if (!this.ctx) {
      // On iPhone, ordinary web audio obeys the silent switch. Asking for a "playback"
      // session (Safari 16.4 and later) makes game sound play regardless, like a native game.
      try {
        const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
        if (session) session.type = 'playback';
      } catch {
        // Not supported here; sound then follows the silent switch.
      }
      const Ctor: AudioCtor | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor({ latencyHint: 'interactive' });
      } catch {
        return;
      }
      this.build(this.ctx);
    }
    const ctx = this.ctx;
    if (ctx.state !== 'running') {
      void ctx.resume().catch(() => undefined);
      // iOS only treats the context as unlocked once a sound has started inside the gesture.
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.start();
    }
  }

  private build(ctx: AudioContext): void {
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -16;
    squash.ratio.value = 5;
    squash.attack.value = 0.002;
    squash.release.value = 0.08;
    squash.connect(ctx.destination);
    this.out = ctx.createGain();
    this.out.gain.value = this._muted ? 0 : 1;
    this.out.connect(squash);

    this.pins = [
      ping(ctx, [3300, 5450, 8100], 0.011, 0.5),
      ping(ctx, [3720, 6010, 8800], 0.01, 0.5),
      ping(ctx, [2950, 4900, 7600], 0.012, 0.45),
      ping(ctx, [4100, 6700, 9400], 0.009, 0.55),
    ];
    this.wall = ping(ctx, [820, 1730, 2900], 0.016, 0.7);
    this.thunk = render(ctx, 0.14, (t) => {
      const f = 150 * Math.exp(-t / 0.05) + 55;
      const body = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.04);
      const snap = Math.sin(2 * Math.PI * 2100 * t) * Math.exp(-t / 0.004) * 0.35;
      return (body + snap) * 0.9;
    });
    this.bell = ping(ctx, [1320, 2640, 3990], 0.09, 0.15);
    this.drop = render(ctx, 0.09, (t) => Math.sin(2 * Math.PI * (240 - 900 * t) * t) * Math.exp(-t / 0.022) * 0.5);
  }

  private play(buffer: AudioBuffer | null | undefined, volume: number, rate: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.out || !buffer || this._muted || ctx.state !== 'running' || volume <= 0.002) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(this.out);
    src.start(ctx.currentTime + delay);
  }

  /** A ball hit something at `speed` board units per second. */
  hit(kind: HitKind, speed: number): void {
    const ctx = this.ctx;
    if (!ctx || speed < QUIET_SPEED) return;
    const now = ctx.currentTime;
    if (now - this.lastTick < MIN_TICK_GAP) return;
    this.lastTick = now;

    const force = Math.min(1, (speed - QUIET_SPEED) / (LOUD_SPEED - QUIET_SPEED));
    const loud = 0.08 + 0.75 * Math.pow(force, 1.4);
    // Harder hits ring a little brighter; random detune keeps a stream from sounding like a machine gun.
    const rate = 0.9 + force * 0.22 + Math.random() * 0.14;
    switch (kind) {
      case 'pin':
        this.play(this.pins[Math.floor(Math.random() * this.pins.length)], loud, rate);
        break;
      case 'ball':
        this.play(this.pins[0], loud * 0.5, rate * 1.25);
        break;
      case 'cup':
        this.play(this.wall, loud * 0.5, rate * 1.3);
        break;
      case 'bumper':
        this.play(this.wall, loud * 0.9, rate * 0.55);
        break;
      default:
        this.play(this.wall, loud * 0.55, rate);
    }
  }

  /** The handle snapped forward and fired a ball. */
  launch(power: number): void {
    this.play(this.thunk, 0.45 + power * 0.35, 0.92 + power * 0.2);
  }

  /** A ball dropped into the out hole. */
  drain(): void {
    this.play(this.drop, 0.3, 0.95 + Math.random() * 0.1);
  }

  /** A ball was caught and the machine pays. */
  win(): void {
    this.play(this.bell, 0.4, 1);
    this.play(this.bell, 0.3, 1.5, 0.07);
  }

  /** One won ball dropped into the tray. */
  coin(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.currentTime - this.lastCoin < 0.05) return;
    this.lastCoin = ctx.currentTime;
    this.play(this.pins[1], 0.12, 1.5 + Math.random() * 0.2);
  }

  /** The tiger opened every tulip. */
  cheer(): void {
    [1, 1.26, 1.5, 2, 1.5, 2, 2.52].forEach((rate, i) => this.play(this.bell, 0.5, rate, i * 0.11));
  }

  /** A tulip snapped open or shut. */
  snap(open: boolean): void {
    this.play(this.wall, 0.3, open ? 1.6 : 1.1);
  }

  /** The bonus strip filled up, or a paw opened two tulips. */
  fanfare(): void {
    [1, 1.5, 2].forEach((rate, i) => this.play(this.bell, 0.4, rate, i * 0.09));
  }
}
