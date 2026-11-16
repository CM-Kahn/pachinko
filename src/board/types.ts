/**
 * Board layouts are data. A board file (see classic.json) is written in "board units":
 * design pixels measured from the centre of the round playfield, x to the right, y down.
 * Angles are in degrees on the screen: 0 = right, 90 = down, 180 = left, 270 = up.
 */

export interface Vec {
  x: number;
  y: number;
}

/** A single pin. */
export interface PinItem {
  type: 'pin';
  x: number;
  y: number;
  mirror?: boolean;
}

/** `n` evenly spaced pins from one point to another, ends included. */
export interface LineItem {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  n: number;
  mirror?: boolean;
}

/** `n` evenly spaced pins along a circular arc, ends included. */
export interface ArcItem {
  type: 'arc';
  cx: number;
  cy: number;
  r: number;
  from: number;
  to: number;
  n: number;
  mirror?: boolean;
}

export type Zone = { x: number; y: number; w: number; h: number } | { cx: number; cy: number; r: number };

/**
 * A staggered field of pins filling the board between two heights, skipping the keep-out
 * zones and anything too close to a pin placed by another item.
 */
export interface FieldItem {
  type: 'field';
  yFrom: number;
  yTo: number;
  dx: number;
  dy: number;
  /** Pins are kept only this close to the centre. */
  maxR: number;
  /** Minimum centre-to-centre distance from pins placed by other items. */
  clearance: number;
  exclude?: Zone[];
}

export type PinSpec = PinItem | LineItem | ArcItem | FieldItem;

/**
 * Somewhere a ball can be caught.
 * - `start`: the pocket under the centre display; a catch spins the reels.
 * - `tulip`: a flower catcher whose petals open wide and close again.
 * - `side`: a plain cup with a small steady payout.
 * - `attacker`: the big gate near the bottom that only opens during a jackpot.
 */
export type PocketKind = 'start' | 'tulip' | 'side' | 'attacker';

export interface PocketSpec {
  id: string;
  kind: PocketKind;
  /** Centre of the mouth. */
  x: number;
  y: number;
  /** Half the width of the mouth. Tulips have a fixed size and ignore this. */
  halfWidth?: number;
  /** Tulips only: a catch here also opens the tulip with this id. */
  opens?: string;
}

export type Pocket = Required<Omit<PocketSpec, 'opens'>> & { opens: string | null };

export interface BoardSpec {
  name: string;
  /** Radius of the outer guide rail. */
  radius: number;
  ballRadius: number;
  pinRadius: number;
  /** Inner guide rail: with the outer rail it forms the launch lane up the left side. */
  rail: { r: number; from: number; to: number };
  /** Where a launched ball appears and how fast it leaves, slowest to fastest pull. */
  launch: { angle: number; r: number; minSpeed: number; maxSpeed: number };
  /** Rubber stoppers that bounce strong shots back into the field. */
  bumpers: { angle: number; r: number; radius: number }[];
  /** The out hole at the bottom of the board. */
  drain: { x: number; y: number; halfWidth: number; halfHeight: number };
  /** The solid centre display that houses the three reels. */
  display: { x: number; y: number; halfWidth: number; halfHeight: number };
  pockets: PocketSpec[];
  pins: PinSpec[];
}

/** A board with everything expanded to plain coordinates, ready to simulate and draw. */
export interface Board {
  name: string;
  radius: number;
  ballRadius: number;
  pinRadius: number;
  pins: Vec[];
  /** Outer rail as a closed loop of points. */
  wall: Vec[];
  /** Inner rail as an open chain of points. */
  rail: Vec[];
  railSpec: BoardSpec['rail'];
  bumpers: (Vec & { radius: number })[];
  launch: Vec & { dirX: number; dirY: number; minSpeed: number; maxSpeed: number };
  drain: BoardSpec['drain'];
  display: BoardSpec['display'];
  pockets: Pocket[];
}
