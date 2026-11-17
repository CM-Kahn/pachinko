import type { HitKind } from '../physics/sim';
import {
  VARIANTS,
  VoiceGate,
  ballClick,
  bell,
  drainDrop,
  hammer,
  impactForce,
  impactGain,
  pinTick,
  plasticTock,
  railRun,
  railTap,
  rubberThud,
  snap,
  trayChink,
} from './synth';

/**
 * The machine's sound. Everything heard is something a real machine would make: steel balls
 * on brass pins, the launcher's hammer, plastic petals snapping, a struck bell, and won
 * balls rattling into the tray. The sounds themselves are built in synth.ts.
 */

type AudioCtor = typeof AudioContext;

interface Bank {
  pins: AudioBuffer[];
  balls: AudioBuffer[];
  rails: AudioBuffer[];
  plastic: AudioBuffer[];
  tray: AudioBuffer[];
  rubber: AudioBuffer;
  bell: AudioBuffer;
  snapOpen: AudioBuffer;
  snapShut: AudioBuffer;
  hammer: AudioBuffer;
  railRun: AudioBuffer;
  drain: AudioBuffer;
}

/** Half a second of silence as a WAV file, for waking iPhone audio (see `unlock`). */
function silentWavUrl(): string {
  const samples = 4000;
  const bytes = new Uint8Array(44 + samples).fill(0x80);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string): void => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, 'data');
  view.setUint32(40, samples, true);
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
}

/** Half the board's width in board units, for placing sounds left to right. */
const BOARD_HALF_WIDTH = 400;

export class Sound {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private bank: Bank | null = null;
  private readonly gate = new VoiceGate();
  private lastCoin = 0;
  private silentTag: HTMLAudioElement | null = null;
  private _muted = false;
  private _volume = 0.8;

  get muted(): boolean {
    return this._muted;
  }

  set muted(value: boolean) {
    this._muted = value;
    this.applyLevel();
  }

  /** Overall loudness, 0 to 1. */
  get volume(): number {
    return this._volume;
  }

  set volume(value: number) {
    this._volume = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.8));
    this.applyLevel();
  }

  private applyLevel(): void {
    if (!this.out || !this.ctx) return;
    // Loudness is heard on a curve, so the slider's middle should sound like half.
    const level = this._muted ? 0 : this._volume * this._volume;
    this.out.gain.setTargetAtTime(level, this.ctx.currentTime, 0.02);
  }

  /**
   * Browsers (iPhone Safari above all) keep audio locked until the player touches the page.
   * Call this from every touch, click and key press; it is cheap once sound is running.
   */
  unlock(): void {
    if (!this.ctx) {
      // On iPhone, ordinary web audio obeys the silent switch. Asking for a "playback"
      // session (Safari 16.4 and later) makes game sound play regardless, like a native game.
      let session: { type: string } | undefined;
      try {
        session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
        if (session) session.type = 'playback';
      } catch {
        session = undefined;
      }
      // Older iPhones have no such setting. There, playing a silent sound through an ordinary
      // audio element has the same effect.
      if (!session && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
        try {
          const tag = new Audio(silentWavUrl());
          tag.loop = true;
          tag.setAttribute('playsinline', '');
          this.silentTag = tag;
        } catch {
          this.silentTag = null;
        }
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
    if (this.silentTag?.paused) void this.silentTag.play().catch(() => undefined);
    // "running" is the only state in which sound comes out; iPhones also report
    // "interrupted" after a call or a trip to another app.
    if (ctx.state !== 'running') {
      void ctx.resume().catch(() => undefined);
      // iPhones only treat the context as unlocked once a sound has started inside the gesture.
      try {
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        src.connect(ctx.destination);
        src.start();
      } catch {
        // Nothing to do; the next touch tries again.
      }
    }
  }

  /** True once sound can actually be heard (for tests and troubleshooting). */
  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  private build(ctx: AudioContext): void {
    // A gentle limiter so a burst of impacts never distorts.
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -14;
    squash.knee.value = 10;
    squash.ratio.value = 6;
    squash.attack.value = 0.002;
    squash.release.value = 0.09;
    squash.connect(ctx.destination);
    this.out = ctx.createGain();
    this.out.gain.value = this._muted ? 0 : this._volume * this._volume;
    this.out.connect(squash);

    const sr = ctx.sampleRate;
    const buffer = (data: Float32Array): AudioBuffer => {
      const b = ctx.createBuffer(1, data.length, sr);
      b.getChannelData(0).set(data);
      return b;
    };
    const many = (count: number, make: (sr: number, variant: number) => Float32Array): AudioBuffer[] =>
      Array.from({ length: count }, (_, i) => buffer(make(sr, i)));
    this.bank = {
      pins: many(VARIANTS.pin, pinTick),
      balls: many(VARIANTS.ball, ballClick),
      rails: many(VARIANTS.rail, railTap),
      plastic: many(VARIANTS.plastic, plasticTock),
      tray: many(VARIANTS.tray, trayChink),
      rubber: buffer(rubberThud(sr)),
      bell: buffer(bell(sr)),
      snapOpen: buffer(snap(sr, true)),
      snapShut: buffer(snap(sr, false)),
      hammer: buffer(hammer(sr)),
      railRun: buffer(railRun(sr)),
      drain: buffer(drainDrop(sr)),
    };
  }

  private get ready(): boolean {
    return !!this.ctx && !!this.out && !!this.bank && !this._muted && this.ctx.state === 'running';
  }

  /**
   * Play one sound. `pan` runs from -1 (left) to 1 (right); `brightness`, when given, dulls
   * the sound for soft impacts (0) and leaves it full for hard ones (1).
   */
  private play(buffer: AudioBuffer, volume: number, rate = 1, options: { pan?: number; delay?: number; brightness?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.out || !this.ready || volume <= 0.002) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    let node: AudioNode = src;
    if (options.brightness !== undefined) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2600 + options.brightness * 15000;
      filter.Q.value = 0.4;
      node = node.connect(filter);
    }
    const gain = ctx.createGain();
    gain.gain.value = volume;
    node = node.connect(gain);
    if (options.pan !== undefined && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.min(1, Math.max(-1, options.pan));
      node = node.connect(panner);
    }
    node.connect(this.out);
    src.start(ctx.currentTime + (options.delay ?? 0));
  }

  private pick(list: AudioBuffer[]): AudioBuffer {
    return list[Math.floor(Math.random() * list.length)]!;
  }

  /** A ball hit something at `speed` board units per second, at board position `x`. */
  hit(kind: HitKind, speed: number, x = 0): void {
    const ctx = this.ctx;
    const bank = this.bank;
    if (!ctx || !bank || !this.ready) return;
    const loud = impactGain(speed);
    if (loud <= 0) return;
    const force = impactForce(speed);
    const pan = (x / BOARD_HALF_WIDTH) * 0.7;
    // Harder hits ring a little higher; a random detune keeps a stream from sounding stamped out.
    const rate = 0.94 + force * 0.1 + Math.random() * 0.12;

    switch (kind) {
      case 'pin':
        if (this.gate.admit(ctx.currentTime, loud, 0.05)) this.play(this.pick(bank.pins), loud * 0.8, rate, { pan, brightness: 0.25 + force * 0.75 });
        break;
      case 'ball':
        if (this.gate.admit(ctx.currentTime, loud * 0.7, 0.02)) this.play(this.pick(bank.balls), loud * 0.5, rate, { pan });
        break;
      case 'bumper':
        if (this.gate.admit(ctx.currentTime, loud, 0.08)) this.play(bank.rubber, loud * 0.9, rate, { pan });
        break;
      case 'cup':
        if (this.gate.admit(ctx.currentTime, loud * 0.8, 0.03)) this.play(this.pick(bank.plastic), loud * 0.6, rate, { pan });
        break;
      default:
        if (this.gate.admit(ctx.currentTime, loud * 0.8, 0.06)) this.play(this.pick(bank.rails), loud * 0.55, rate, { pan, brightness: 0.3 + force * 0.7 });
    }
  }

  /** The handle snapped forward: the hammer strikes and the ball runs up the rail. */
  launch(power: number): void {
    const bank = this.bank;
    if (!bank) return;
    this.play(bank.hammer, 0.5 + power * 0.4, 0.94 + power * 0.14, { pan: 0.45 });
    this.play(bank.railRun, 0.1 + power * 0.22, 0.85 + power * 0.4, { pan: -0.5, delay: 0.02 });
  }

  /** A ball dropped into the out hole. */
  drain(): void {
    if (this.bank) this.play(this.bank.drain, 0.32, 0.94 + Math.random() * 0.12);
  }

  /** A ball was caught: it knocks into the pocket and the payout bell is struck. */
  win(x = 0): void {
    const bank = this.bank;
    if (!bank) return;
    const pan = (x / BOARD_HALF_WIDTH) * 0.7;
    this.play(this.pick(bank.plastic), 0.5, 0.8, { pan });
    this.play(bank.bell, 0.42, 1, { pan: pan * 0.4, delay: 0.03 });
  }

  /** One won ball dropped into the tray. */
  coin(): void {
    const ctx = this.ctx;
    const bank = this.bank;
    if (!ctx || !bank || ctx.currentTime - this.lastCoin < 0.028) return;
    this.lastCoin = ctx.currentTime;
    this.play(this.pick(bank.tray), 0.2 + Math.random() * 0.12, 0.9 + Math.random() * 0.25, { pan: -0.35 + Math.random() * 0.3 });
  }

  /** A tray of balls poured in (the free refill). */
  pour(): void {
    const bank = this.bank;
    if (!bank) return;
    for (let i = 0; i < 46; i++) {
      const t = (i / 46) * 0.9 + Math.random() * 0.03;
      // Thick at first, thinning out as the last balls settle.
      const level = 0.3 * (1 - (i / 46) * 0.6);
      this.play(this.pick(bank.tray), level * (0.7 + Math.random() * 0.5), 0.85 + Math.random() * 0.35, { pan: -0.4 + Math.random() * 0.5, delay: t });
    }
  }

  /** A tulip's petals snapped open or shut. */
  snap(open: boolean, x = 0): void {
    const bank = this.bank;
    if (!bank) return;
    this.play(open ? bank.snapOpen : bank.snapShut, 0.5, 0.95 + Math.random() * 0.1, { pan: (x / BOARD_HALF_WIDTH) * 0.7 });
  }

  /** The tiger opened every tulip: the bell rings and rings, as an electric bell does. */
  cheer(): void {
    const bank = this.bank;
    if (!bank) return;
    const strikes = 16;
    for (let i = 0; i < strikes; i++) {
      this.play(bank.bell, 0.34 * (i === 0 ? 1.2 : 0.75 + Math.random() * 0.25), 1, { delay: 0.05 + i * 0.062 });
    }
  }

  /** A smaller celebration (a paw, or the bonus strip filling): the bell is struck three times. */
  fanfare(): void {
    const bank = this.bank;
    if (!bank) return;
    for (let i = 0; i < 3; i++) this.play(bank.bell, 0.4, 1, { delay: 0.05 + i * 0.13 });
  }
}
