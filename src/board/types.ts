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
 * - `tulip`: a flower catcher whose petals open wide and close again.
 * - `side`: a plain cup.
 * - `crown`: the top of the tiger's head, between the ears (the ears are its walls).
 * - `paw`: one of the tiger's raised paws.
 * - `chin`: the pocket under the tiger's chin.
 */
export type PocketKind = 'tulip' | 'side' | 'crown' | 'paw' | 'chin';

export interface PocketSpec {
  id: string;
  kind: PocketKind;
  /** Centre of the mouth. */
  x: number;
  y: number;
  /** Half the width of the mouth. Tulips and the crown have a fixed size and ignore this. */
  halfWidth?: number;
  /** A catch here opens these tulips (by id), or every tulip on the board. */
  opens?: string[] | 'all';
}

export type Pocket = Required<Omit<PocketSpec, 'opens'>> & { opens: string[] };

/** The tiger's head in the middle of the board: a round head with two round ears. */
export interface TigerSpec {
  x: number;
  y: number;
  radius: number;
  /** Ear centres are this far out and up from the centre of the head. */
  earDx: number;
  earDy: number;
  earRadius: number;
}

/**
 * A pair of pins above a catcher whose spacing the luck setting adjusts, as a parlour would
 * by bending them: wider lets more balls through, narrower turns more away. Spacings are
 * between pin centres, for the hardest, normal and easiest settings.
 */
export interface GateSpec {
  x: number;
  y: number;
  min: number;
  normal: number;
  max: number;
}

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
  tiger: TigerSpec;
  /** Free-spinning windmills, all the same size. */
  windmillRadius: number;
  windmills: Vec[];
  pockets: PocketSpec[];
  gates: GateSpec[];
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
  tiger: TigerSpec;
  windmillRadius: number;
  windmills: Vec[];
  pockets: Pocket[];
  gates: GateSpec[];
}
