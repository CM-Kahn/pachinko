import type { Pocket, Vec } from './types';

/**
 * The shapes of the catchers, shared by the physics (as walls) and the drawing.
 * All points are relative to the centre of the catcher's mouth, y down.
 */

export const TULIP_OPEN_HALF_WIDTH = 30;
export const TULIP_CLOSED_HALF_WIDTH = 14;
const TULIP_BASE = 10;
const TULIP_TOP = -8;
const TULIP_FLOOR = 18;

/** The two petals and the floor of a tulip, as one open chain from left tip to right tip. */
export function tulipOutline(open: boolean): Vec[] {
  const tip = open ? TULIP_OPEN_HALF_WIDTH : TULIP_CLOSED_HALF_WIDTH;
  return [
    { x: -tip, y: TULIP_TOP },
    { x: -TULIP_BASE, y: TULIP_FLOOR },
    { x: TULIP_BASE, y: TULIP_FLOOR },
    { x: tip, y: TULIP_TOP },
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

/** Walls of a pocket in its current state; the attacker has none (it is a trapdoor). */
export function pocketOutline(pocket: Pocket, open: boolean): Vec[] {
  if (pocket.kind === 'tulip') return tulipOutline(open);
  if (pocket.kind === 'attacker') return [];
  return cupOutline(pocket.halfWidth);
}

/** True when a ball centred at (dx, dy) from the mouth has been caught. */
export function isCaught(pocket: Pocket, open: boolean, dx: number, dy: number): boolean {
  switch (pocket.kind) {
    case 'tulip':
      return Math.abs(dx) < 12 && dy > -2 && dy < 15;
    case 'attacker':
      return open && Math.abs(dx) < pocket.halfWidth && Math.abs(dy) < 12;
    default:
      return Math.abs(dx) < pocket.halfWidth - 9 && dy > -4 && dy < 13;
  }
}
