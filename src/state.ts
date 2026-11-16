export interface GameState {
  /** Balls the player has left to shoot. */
  ballsRemaining: number;
  /** Total balls won on this device. Carries over between visits. */
  ballsAwarded: number;
}

export const STARTING_BALLS = 250;
const KEY = 'pachinko.progress';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function deviceStore(): Store | null {
  try {
    return window.localStorage;
  } catch {
    // Private browsing can block storage; progress then lasts for the visit only.
    return null;
  }
}

/** Balls Awarded from saved text; zero for anything missing or odd. */
export function parseAwarded(text: string | null | undefined): number {
  try {
    const raw: unknown = text ? JSON.parse(text) : null;
    const n = (raw as { ballsAwarded?: unknown } | null)?.ballsAwarded;
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** A fresh tray of balls, with Balls Awarded picked up from the last visit. */
export function newGameState(store: Store | null = deviceStore()): GameState {
  let ballsAwarded = 0;
  try {
    ballsAwarded = parseAwarded(store?.getItem(KEY));
  } catch {
    // Storage unavailable; start from zero.
  }
  return { ballsRemaining: STARTING_BALLS, ballsAwarded };
}

export function saveProgress(state: GameState, store: Store | null = deviceStore()): void {
  try {
    store?.setItem(KEY, JSON.stringify({ ballsAwarded: state.ballsAwarded }));
  } catch {
    // Not saved; nothing useful to do about it.
  }
}
