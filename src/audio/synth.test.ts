import { describe, expect, it } from 'vitest';
import {
  LOUD_SPEED,
  QUIET_SPEED,
  VARIANTS,
  VoiceGate,
  ballClick,
  bell,
  drainDrop,
  hammer,
  impactGain,
  pinTick,
  plasticTock,
  railRun,
  railTap,
  rubberThud,
  snap,
  strike,
  trayChink,
} from './synth';

const SR = 48000;

function peak(data: Float32Array, from = 0, to = data.length): number {
  let max = 0;
  for (let i = from; i < to; i++) max = Math.max(max, Math.abs(data[i]!));
  return max;
}

/** The frequency carrying the most energy, found by testing a ladder of tones. */
function dominant(data: Float32Array, lo: number, hi: number, sr = SR): number {
  let best = lo;
  let bestPower = 0;
  for (let f = lo; f <= hi; f *= 1.03) {
    let re = 0;
    let im = 0;
    const w = (2 * Math.PI * f) / sr;
    for (let i = 0; i < data.length; i++) {
      re += data[i]! * Math.cos(w * i);
      im += data[i]! * Math.sin(w * i);
    }
    const power = re * re + im * im;
    if (power > bestPower) {
      bestPower = power;
      best = f;
    }
  }
  return best;
}

describe('the sound set', () => {
  const sounds: [string, Float32Array, number][] = [
    ['pin', pinTick(SR, 0), 0.3],
    ['ball', ballClick(SR, 0), 0.1],
    ['rail', railTap(SR, 0), 0.3],
    ['plastic', plasticTock(SR, 0), 0.1],
    ['rubber', rubberThud(SR), 0.4],
    ['bell', bell(SR), 2],
    ['tray', trayChink(SR, 0), 0.3],
    ['snap open', snap(SR, true), 0.2],
    ['snap shut', snap(SR, false), 0.2],
    ['hammer', hammer(SR), 0.5],
    ['rail run', railRun(SR), 0.7],
    ['drain', drainDrop(SR), 0.5],
  ];

  it.each(sounds)('%s is clean: finite, full-bodied, short, and ends in silence', (_name, data, maxSeconds) => {
    expect(data.every((v) => Number.isFinite(v))).toBe(true);
    expect(peak(data)).toBeGreaterThan(0.5);
    expect(peak(data)).toBeLessThanOrEqual(1);
    expect(data.length / SR).toBeLessThanOrEqual(maxSeconds);
    // No click at the end: the last sample is silent and the tail has died away.
    expect(Math.abs(data[data.length - 1]!)).toBeLessThan(0.001);
    expect(peak(data, Math.floor(data.length * 0.9))).toBeLessThan(0.08);
  });

  it('gives every repeated sound several different versions', () => {
    const pins = Array.from({ length: VARIANTS.pin }, (_, i) => pinTick(SR, i));
    const pitches = new Set(pins.map((p) => Math.round(dominant(p, 2500, 7000) / 50)));
    expect(pitches.size).toBeGreaterThanOrEqual(5);
    // The same version is identical every time it is made.
    expect(pinTick(SR, 2)).toEqual(pinTick(SR, 2));
  });

  it('pitches each material where it belongs: plastic low, rail middle, pin high, ball highest', () => {
    const plastic = dominant(plasticTock(SR, 0), 200, 12000);
    const rail = dominant(railTap(SR, 0), 200, 12000);
    const pin = dominant(pinTick(SR, 0), 200, 12000);
    const ball = dominant(ballClick(SR, 0), 200, 12000);
    expect(plastic).toBeLessThan(rail);
    expect(rail).toBeLessThan(pin);
    expect(pin).toBeLessThan(ball);
  });

  it('rings the bell far longer than a pin', () => {
    const ringing = (d: Float32Array): number => {
      let last = 0;
      for (let i = 0; i < d.length; i++) if (Math.abs(d[i]!) > 0.05) last = i;
      return last / SR;
    };
    expect(ringing(bell(SR))).toBeGreaterThan(0.5);
    expect(ringing(pinTick(SR, 0))).toBeLessThan(0.12);
  });

  it('leaves out tones the sample rate cannot carry', () => {
    const data = strike(8000, [
      { f: 1000, decay: 0.01, amp: 1 },
      { f: 7000, decay: 0.01, amp: 1 },
    ]);
    // 7 kHz cannot be carried at 8 kHz; had it been kept it would have folded down to 1 kHz's
    // neighbourhood and doubled the energy there. Only the 1 kHz tone remains.
    expect(dominant(data, 500, 3900, 8000)).toBeGreaterThan(900);
    expect(dominant(data, 500, 3900, 8000)).toBeLessThan(1100);
  });
});

describe('impact loudness', () => {
  it('is silent for the gentlest touches and grows with speed', () => {
    expect(impactGain(QUIET_SPEED - 1)).toBe(0);
    const speeds = [100, 300, 700, 1200, LOUD_SPEED];
    const gains = speeds.map(impactGain);
    for (let i = 1; i < gains.length; i++) expect(gains[i]!).toBeGreaterThan(gains[i - 1]!);
    expect(impactGain(LOUD_SPEED * 3)).toBeCloseTo(impactGain(LOUD_SPEED));
    expect(impactGain(LOUD_SPEED)).toBeLessThanOrEqual(1);
  });
});

describe('VoiceGate', () => {
  it('never lets two sounds start closer together than its gap', () => {
    const gate = new VoiceGate(18, 0.006);
    expect(gate.admit(1, 0.5, 0.05)).toBe(true);
    expect(gate.admit(1.003, 0.9, 0.05)).toBe(false);
    expect(gate.admit(1.007, 0.5, 0.05)).toBe(true);
  });

  it('caps how many sound at once and frees voices as they finish', () => {
    const gate = new VoiceGate(4, 0);
    for (let i = 0; i < 4; i++) expect(gate.admit(1 + i * 0.001, 1, 0.1)).toBe(true);
    expect(gate.admit(1.005, 1, 0.1)).toBe(false);
    expect(gate.active).toBe(4);
    expect(gate.admit(1.2, 1, 0.1)).toBe(true);
    expect(gate.active).toBe(1);
  });

  it('drops quiet impacts first when things get busy', () => {
    const gate = new VoiceGate(10, 0);
    for (let i = 0; i < 8; i++) gate.admit(1 + i * 0.001, 1, 1);
    expect(gate.admit(1.01, 0.1, 1)).toBe(false);
    expect(gate.admit(1.011, 0.9, 1)).toBe(true);
    expect(gate.admit(1.012, 0, 1)).toBe(false);
  });
});
