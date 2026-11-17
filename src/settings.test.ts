import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, clampLuck, loadSettings, parseSettings, saveSettings, snapLuck } from './settings';

function memoryStore(): { getItem(k: string): string | null; setItem(k: string, v: string): void } {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('settings', () => {
  it('starts with sound on and luck in the middle', () => {
    expect(loadSettings(memoryStore())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.luck).toBe(0);
  });

  it('remembers what was saved', () => {
    const store = memoryStore();
    saveSettings({ soundOn: false, volume: 0.3, luck: 0.4, payout: 25 }, store);
    expect(loadSettings(store)).toEqual({ soundOn: false, volume: 0.3, luck: 0.4, payout: 25 });
  });

  it('survives damaged or strange saved data', () => {
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('[1,2]')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"soundOn":"yes","luck":"lots"}')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"luck":99}').luck).toBe(1);
    expect(parseSettings('{"luck":-99}').luck).toBe(-1);
    expect(parseSettings('{"volume":5}').volume).toBe(1);
    expect(parseSettings('{"volume":"loud"}').volume).toBe(DEFAULT_SETTINGS.volume);
    expect(parseSettings('{"volume":0}').volume).toBe(0);
    expect(parseSettings('{"payout":7}').payout).toBe(DEFAULT_SETTINGS.payout);
    expect(parseSettings('{"payout":10}').payout).toBe(10);
  });

  it('survives storage that throws', () => {
    const broken = {
      getItem: (): string => {
        throw new Error('blocked');
      },
      setItem: (): void => {
        throw new Error('full');
      },
    };
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings({ soundOn: true, volume: 1, luck: 1, payout: 5 }, broken)).not.toThrow();
  });

  it('keeps luck in range and snaps to the default near the middle', () => {
    expect(clampLuck(2)).toBe(1);
    expect(clampLuck(-2)).toBe(-1);
    expect(clampLuck(Number.NaN)).toBe(0);
    expect(snapLuck(0.03)).toBe(0);
    expect(snapLuck(-0.05)).toBe(0);
    expect(snapLuck(0.5)).toBe(0.5);
    expect(snapLuck(-1.5)).toBe(-1);
  });
});
