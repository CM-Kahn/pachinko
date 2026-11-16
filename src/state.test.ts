import { describe, expect, it } from 'vitest';
import { STARTING_BALLS, newGameState, parseAwarded, saveProgress } from './state';

function memoryStore(): { getItem(k: string): string | null; setItem(k: string, v: string): void } {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('game state', () => {
  it('starts a first visit with a full tray and nothing awarded', () => {
    expect(newGameState(memoryStore())).toEqual({ ballsRemaining: STARTING_BALLS, ballsAwarded: 0 });
    expect(newGameState(null)).toEqual({ ballsRemaining: STARTING_BALLS, ballsAwarded: 0 });
  });

  it('carries Balls Awarded over to the next visit, with a fresh tray', () => {
    const store = memoryStore();
    saveProgress({ ballsRemaining: 12, ballsAwarded: 1234 }, store);
    expect(newGameState(store)).toEqual({ ballsRemaining: STARTING_BALLS, ballsAwarded: 1234 });
  });

  it('ignores damaged saved data', () => {
    expect(parseAwarded('nope')).toBe(0);
    expect(parseAwarded('{"ballsAwarded":-5}')).toBe(0);
    expect(parseAwarded('{"ballsAwarded":"many"}')).toBe(0);
    expect(parseAwarded('{"ballsAwarded":7.9}')).toBe(7);
    expect(parseAwarded(null)).toBe(0);
  });
});
