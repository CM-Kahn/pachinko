import type { Pocket, TigerSpec, Vec } from './types';

/**
 * The shapes of the catchers, shared by the physics (as walls) and the drawing.
 * All points are relative to the centre of the catcher's mouth, y down.
 */

export const TULIP_OPEN_HALF_WIDTH = 26;
export const TULIP_CLOSED_HALF_WIDTH = 15;
const TULIP_BASE = 11;
const TULIP_TOP = -8;
const TULIP_FLOOR = 18;

/**
 * The two petals and the floor of a tulip, as one open chain from left tip to right tip.
 * Each petal is a rigid flap hinged at the end of the floor, so it is the same length open
 * or shut: opening only swings it outwards.
 */
export function tulipOutline(open: boolean): Vec[] {
  const tip = open ? TULIP_OPEN_HALF_WIDTH : TULIP_CLOSED_HALF_WIDTH;
  const length = Math.hypot(TULIP_CLOSED_HALF_WIDTH - TULIP_BASE, TULIP_FLOOR - TULIP_TOP);
  const top = TULIP_FLOOR - Math.sqrt(length * length - (tip - TULIP_BASE) ** 2);
  return [
    { x: -tip, y: top },
    { x: -TULIP_BASE, y: TULIP_FLOOR },
    { x: TULIP_BASE, y: TULIP_FLOOR },
    { x: tip, y: top },
  ];
}

/** A plain cup: two short walls and a floor. */
export function cupOutline(halfWidth: number): Vec[] {
  return [
    { x: -halfWidth, y: -10 },
    { x: -halfWidth + 3, y: 16 },
    { x: halfWidth - 3, y: 16 },
    { x: halfWidth, y: -10 },
  ];
}

/** Walls of a pocket in its current state; the crown has none (the tiger's ears are its walls). */
export function pocketOutline(pocket: Pocket, open: boolean): Vec[] {
  if (pocket.kind === 'tulip') return tulipOutline(open);
  if (pocket.kind === 'crown') return [];
  return cupOutline(pocket.halfWidth);
}

/** True when a ball centred at (dx, dy) from the mouth has been caught. */
export function isCaught(pocket: Pocket, dx: number, dy: number): boolean {
  switch (pocket.kind) {
    case 'tulip':
      return Math.abs(dx) < 12 && dy > -8 && dy < 15;
    case 'crown':
      return Math.abs(dx) < 12 && dy > -16 && dy < 10;
    default:
      return Math.abs(dx) < pocket.halfWidth - 9 && dy > -4 && dy < 13;
  }
}

/** The solid parts of the tiger, as circles: the head, then the two ears. */
export function tigerCircles(t: TigerSpec): { x: number; y: number; r: number }[] {
  return [
    { x: t.x, y: t.y, r: t.radius },
    { x: t.x - t.earDx, y: t.y - t.earDy, r: t.earRadius },
    { x: t.x + t.earDx, y: t.y - t.earDy, r: t.earRadius },
  ];
}

/** How many blades a windmill has. */
export const WINDMILL_BLADES = 6;
