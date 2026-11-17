import { TULIP_OPEN_HALF_WIDTH } from './shapes';
import type { Board, BoardSpec, FieldItem, PinSpec, Pocket, Vec, Zone } from './types';

const RAD = Math.PI / 180;

export function polar(angleDeg: number, r: number): Vec {
  return { x: Math.cos(angleDeg * RAD) * r, y: Math.sin(angleDeg * RAD) * r };
}

/** Angle of a point around the board centre, in degrees from 0 up to (not including) 360. */
export function angleOf(x: number, y: number): number {
  const a = Math.atan2(y, x) / RAD;
  return a < 0 ? a + 360 : a;
}

function inZone(p: Vec, z: Zone): boolean {
  if ('r' in z) return Math.hypot(p.x - z.cx, p.y - z.cy) < z.r;
  return p.x > z.x && p.x < z.x + z.w && p.y > z.y && p.y < z.y + z.h;
}

function placed(item: Exclude<PinSpec, FieldItem>): Vec[] {
  const out: Vec[] = [];
  const steps = (n: number): number[] => (n <= 1 ? [0] : Array.from({ length: n }, (_, i) => i / (n - 1)));
  if (item.type === 'pin') {
    out.push({ x: item.x, y: item.y });
  } else if (item.type === 'line') {
    for (const t of steps(item.n)) out.push({ x: item.x1 + (item.x2 - item.x1) * t, y: item.y1 + (item.y2 - item.y1) * t });
  } else {
    for (const t of steps(item.n)) {
      const p = polar(item.from + (item.to - item.from) * t, item.r);
      out.push({ x: item.cx + p.x, y: item.cy + p.y });
    }
  }
  if (item.mirror) out.push(...out.map((p) => ({ x: -p.x, y: p.y })));
  return out;
}

function field(item: FieldItem, others: Vec[], keepOut: Zone[]): Vec[] {
  const out: Vec[] = [];
  let row = 0;
  for (let y = item.yFrom; y <= item.yTo + 1e-6; y += item.dy, row++) {
    const offset = row % 2 === 0 ? 0 : item.dx / 2;
    const kMax = Math.ceil(item.maxR / item.dx) + 1;
    for (let k = -kMax; k <= kMax; k++) {
      // Build each row outwards from the centre so the field is left-right symmetric.
      const x = offset === 0 ? k * item.dx : (k < 0 ? k + 0.5 : k - 0.5) * item.dx;
      if (offset !== 0 && k === 0) continue;
      const p = { x, y };
      if (Math.hypot(x, y) > item.maxR) continue;
      if (item.exclude?.some((z) => inZone(p, z)) || keepOut.some((z) => inZone(p, z))) continue;
      if (others.some((o) => Math.hypot(o.x - x, o.y - y) < item.clearance)) continue;
      out.push(p);
    }
  }
  return out;
}

function dedupe(pins: Vec[]): Vec[] {
  const out: Vec[] = [];
  for (const p of pins) {
    if (!out.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 1)) out.push(p);
  }
  return out;
}

function arcPoints(r: number, from: number, to: number, stepDeg: number): Vec[] {
  const n = Math.max(1, Math.ceil(Math.abs(to - from) / stepDeg));
  return Array.from({ length: n + 1 }, (_, i) => polar(from + ((to - from) * i) / n, r));
}

/** Expand a board file into plain coordinates. Throws if the layout is unplayable. */
export function loadBoard(spec: BoardSpec): Board {
  const tulipIds = spec.pockets.filter((p) => p.kind === 'tulip').map((p) => p.id);
  const pockets: Pocket[] = spec.pockets.map((p) => ({
    id: p.id,
    kind: p.kind,
    x: p.x,
    y: p.y,
    halfWidth: p.kind === 'tulip' ? TULIP_OPEN_HALF_WIDTH : p.kind === 'crown' ? 12 : (p.halfWidth ?? 24),
    opens: p.opens === 'all' ? tulipIds : (p.opens ?? []),
  }));
  const ids = new Set(pockets.map((p) => p.id));
  if (ids.size !== pockets.length) throw new Error(`Board "${spec.name}": two pockets share an id`);
  for (const p of pockets) {
    for (const id of p.opens) {
      if (!tulipIds.includes(id)) throw new Error(`Board "${spec.name}": pocket "${p.id}" opens "${id}", which is not a tulip`);
    }
  }
  // Field pins keep clear of every catcher and windmill so a ball always has room.
  const keepOut: Zone[] = [
    ...pockets.map((p) => ({ x: p.x - p.halfWidth - 24, y: p.y - 44, w: (p.halfWidth + 24) * 2, h: 84 })),
    ...spec.windmills.map((w) => ({ cx: w.x, cy: w.y, r: spec.windmillRadius + 30 })),
  ];

  const explicit = dedupe(spec.pins.flatMap((item) => (item.type === 'field' ? [] : placed(item))));
  const fields = spec.pins.flatMap((item) => (item.type === 'field' ? field(item, explicit, keepOut) : []));
  const pins = dedupe([...explicit, ...fields]);

  for (const p of pins) {
    if (Math.hypot(p.x, p.y) > spec.radius - spec.pinRadius) {
      throw new Error(`Board "${spec.name}": pin at ${p.x},${p.y} is outside the playfield`);
    }
  }

  const start = polar(spec.launch.angle, spec.launch.r);
  // Launch along the rail in the direction of increasing angle: up the left side.
  const dir = polar(spec.launch.angle + 90, 1);

  return {
    name: spec.name,
    radius: spec.radius,
    ballRadius: spec.ballRadius,
    pinRadius: spec.pinRadius,
    pins,
    wall: arcPoints(spec.radius, 0, 360, 1.5).slice(0, -1),
    rail: arcPoints(spec.rail.r, spec.rail.from, spec.rail.to, 1.5),
    railSpec: spec.rail,
    bumpers: spec.bumpers.map((b) => ({ ...polar(b.angle, b.r), radius: b.radius })),
    launch: { ...start, dirX: dir.x, dirY: dir.y, minSpeed: spec.launch.minSpeed, maxSpeed: spec.launch.maxSpeed },
    drain: spec.drain,
    tiger: spec.tiger,
    windmillRadius: spec.windmillRadius,
    windmills: spec.windmills,
    pockets,
  };
}
