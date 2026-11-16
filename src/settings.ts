/** Player preferences, saved on the device. */
export interface Settings {
  soundOn: boolean;
  /**
   * How kind the machine is, from -1 (harder) through 0 (the default) to +1 (easier).
   * It changes how likely a ball is to find a pocket.
   */
  luck: number;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = { soundOn: true, luck: 0 };
const KEY = 'pachinko.settings';
/** The luck slider settles on the default when let go this close to the middle. */
export const LUCK_SNAP = 0.07;

export function clampLuck(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return Math.min(1, Math.max(-1, n));
}

/** Luck for a slider position, snapping to the default near the middle. */
export function snapLuck(value: number): number {
  const luck = clampLuck(value);
  return Math.abs(luck) < LUCK_SNAP ? 0 : luck;
}

/** Read saved text into settings, falling back to defaults for anything missing or odd. */
export function parseSettings(text: string | null | undefined): Settings {
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = null;
  }
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    soundOn: typeof o.soundOn === 'boolean' ? o.soundOn : DEFAULT_SETTINGS.soundOn,
    luck: clampLuck(o.luck),
  };
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function deviceStore(): Store | null {
  try {
    return window.localStorage;
  } catch {
    // Private browsing can block storage; settings then last for the visit only.
    return null;
  }
}

export function loadSettings(store: Store | null = deviceStore()): Settings {
  try {
    return parseSettings(store?.getItem(KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings, store: Store | null = deviceStore()): void {
  try {
    store?.setItem(KEY, JSON.stringify({ soundOn: settings.soundOn, luck: clampLuck(settings.luck) }));
  } catch {
    // Not saved; nothing useful to do about it.
  }
}
