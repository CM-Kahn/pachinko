import { Container, FillGradient, Graphics, Text } from 'pixi.js';
import { DESIGN_H, DESIGN_W } from '../layout';
import type { GameState } from '../state';
import { CHROME_STOPS, COLORS, FONT_STACK } from '../theme';
import { LedCounter } from './ledCounter';

/** Where things sit in the 900 x 1600 design space. Later phases build on these. */
export const PLAYFIELD = { cx: 450, cy: 624, radius: 400 } as const;
const HEADER = { x: 60, y: 44, w: 780, h: 120 } as const;
const FIELD_PANEL = { x: 30, y: 184, w: 840, h: 880 } as const;
const CONTROL_PANEL = { x: 30, y: 1084, w: 840, h: 486 } as const;
const LEVER = { cx: 678, cy: 1330, radius: 132 } as const;
const BONUS_LIGHTS = 9;

/** Small deterministic random source so the wood grain is identical on every load. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chrome(vertical = true): FillGradient {
  return new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: vertical ? { x: 0, y: 1 } : { x: 1, y: 1 },
    colorStops: CHROME_STOPS,
    textureSpace: 'local',
  });
}

/** A wood slab with wavy grain lines, clipped to a rounded rectangle. */
function woodSlab(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  base: number,
  grainAlongX: boolean,
  seed: number,
): Container {
  const slab = new Container();
  slab.addChild(new Graphics().roundRect(x, y, w, h, r).fill(base));

  const rand = seeded(seed);
  const grain = new Graphics();
  const across = grainAlongX ? h : w;
  const along = grainAlongX ? w : h;
  for (let pos = 4; pos < across; pos += 5 + rand() * 12) {
    const amp = 1 + rand() * 4;
    const freq = 0.004 + rand() * 0.01;
    const phase = rand() * Math.PI * 2;
    for (let d = 0; d <= along; d += 24) {
      const wobble = pos + Math.sin(d * freq + phase) * amp;
      const px = grainAlongX ? x + d : x + wobble;
      const py = grainAlongX ? y + wobble : y + d;
      if (d === 0) grain.moveTo(px, py);
      else grain.lineTo(px, py);
    }
    const dark = rand() > 0.35;
    grain.stroke({ width: 1 + rand() * 2, color: dark ? 0x2a1608 : 0xc88a52, alpha: 0.1 + rand() * 0.16 });
  }
  const clip = new Graphics().roundRect(x, y, w, h, r).fill(0xffffff);
  grain.mask = clip;
  slab.addChild(clip, grain);
  return slab;
}

function screw(x: number, y: number, angle: number): Graphics {
  const g = new Graphics().circle(0, 0, 9).fill(chrome()).circle(0, 0, 9).stroke({ width: 1.5, color: 0x3c4348, alpha: 0.8 });
  g.moveTo(-6, 0).lineTo(6, 0).stroke({ width: 2.2, color: 0x30363a });
  g.position.set(x, y);
  g.rotation = angle;
  return g;
}

function buildHeader(): Container {
  const c = new Container();
  c.addChild(
    new Graphics()
      .roundRect(HEADER.x - 5, HEADER.y - 5, HEADER.w + 10, HEADER.h + 10, 26)
      .fill(chrome())
      .roundRect(HEADER.x, HEADER.y, HEADER.w, HEADER.h, 22)
      .fill(COLORS.tealDeep)
      .roundRect(HEADER.x + 8, HEADER.y + 8, HEADER.w - 16, HEADER.h - 16, 16)
      .stroke({ width: 2, color: COLORS.cream, alpha: 0.35 }),
  );

  const titleStyle = { fontFamily: FONT_STACK, fontSize: 54, fontWeight: '800' as const, letterSpacing: 18 };
  // Neon tube look: a soft wide glow under a bright core.
  const glow = new Text({ text: 'PACHINKO', style: { ...titleStyle, fill: COLORS.neon, stroke: { color: COLORS.neon, width: 10, join: 'round' } } });
  glow.alpha = 0.28;
  const core = new Text({ text: 'PACHINKO', style: { ...titleStyle, fill: 0xfff1e6, stroke: { color: COLORS.neon, width: 3, join: 'round' } } });
  for (const t of [glow, core]) {
    t.anchor.set(0.5);
    t.position.set(DESIGN_W / 2 + 9, HEADER.y + 46);
    c.addChild(t);
  }

  // Bonus light strip: unlit bulbs for now; they come alive in Phase 3.
  const bulbs = new Graphics();
  const span = 520;
  for (let i = 0; i < BONUS_LIGHTS; i++) {
    const x = DESIGN_W / 2 - span / 2 + (span * i) / (BONUS_LIGHTS - 1);
    const y = HEADER.y + 96;
    bulbs.circle(x, y, 10).fill(0x0f3a3d).circle(x, y, 7.5).fill(0x5a2a22).circle(x - 2.5, y - 2.5, 2.2).fill({ color: 0xffffff, alpha: 0.35 });
  }
  c.addChild(bulbs);
  return c;
}

function buildPlayfield(): Container {
  const c = new Container();
  const { cx, cy, radius } = PLAYFIELD;

  // Cream enamel panel that frames the round playfield.
  c.addChild(
    new Graphics()
      .roundRect(FIELD_PANEL.x - 4, FIELD_PANEL.y - 4, FIELD_PANEL.w + 8, FIELD_PANEL.h + 8, 34)
      .fill(chrome())
      .roundRect(FIELD_PANEL.x, FIELD_PANEL.y, FIELD_PANEL.w, FIELD_PANEL.h, 30)
      .fill(
        new FillGradient({
          type: 'linear',
          start: { x: 0, y: 0 },
          end: { x: 0, y: 1 },
          colorStops: [
            { offset: 0, color: COLORS.cream },
            { offset: 1, color: COLORS.creamShade },
          ],
          textureSpace: 'local',
        }),
      ),
  );

  // Chrome ring, dark groove, then the teal board face.
  c.addChild(
    new Graphics()
      .circle(cx, cy + 5, radius + 20)
      .fill({ color: 0x000000, alpha: 0.22 })
      .circle(cx, cy, radius + 18)
      .fill(chrome(false))
      .circle(cx, cy, radius + 5)
      .fill(COLORS.ink)
      .circle(cx, cy, radius)
      .fill(
        new FillGradient({
          type: 'radial',
          center: { x: 0.5, y: 0.42 },
          innerRadius: 0,
          outerCenter: { x: 0.5, y: 0.5 },
          outerRadius: 0.5,
          colorStops: [
            { offset: 0, color: 0x3aa19c },
            { offset: 0.7, color: COLORS.teal },
            { offset: 1, color: COLORS.tealDeep },
          ],
          textureSpace: 'local',
        }),
      ),
  );

  // Mid-century starburst, very faint, so the empty board isn't blank.
  const star = new Graphics();
  const points = 16;
  const pts: number[] = [];
  for (let i = 0; i < points * 2; i++) {
    const long = i % 4 === 0;
    const r = i % 2 === 1 ? 26 : long ? 230 : 130;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  star.poly(pts).fill({ color: COLORS.cream, alpha: 0.1 });
  star.circle(cx, cy, 300).stroke({ width: 2, color: COLORS.cream, alpha: 0.1 });
  c.addChild(star);

  // Glass: a soft highlight arc across the upper left.
  const glass = new Graphics();
  glass
    .arc(cx, cy, radius - 14, Math.PI * 1.08, Math.PI * 1.45)
    .stroke({ width: 10, color: 0xffffff, alpha: 0.1, cap: 'round' })
    .arc(cx, cy, radius - 34, Math.PI * 1.14, Math.PI * 1.34)
    .stroke({ width: 5, color: 0xffffff, alpha: 0.08, cap: 'round' });
  c.addChild(glass);
  return c;
}

function buildLever(): Container {
  const c = new Container();
  const { cx, cy, radius } = LEVER;
  c.addChild(
    new Graphics()
      .circle(cx, cy + 6, radius + 6)
      .fill({ color: 0x000000, alpha: 0.35 })
      .circle(cx, cy, radius)
      .fill(chrome(false))
      .circle(cx, cy, radius - 14)
      .fill(COLORS.ink)
      .circle(cx, cy, radius - 18)
      .fill(COLORS.cream),
  );

  // Power scale around the dial.
  const ticks = new Graphics();
  const from = Math.PI * 0.75;
  const to = Math.PI * 2.25;
  const n = 20;
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    const major = i % 5 === 0;
    const r0 = radius - (major ? 46 : 38);
    const r1 = radius - 26;
    ticks
      .moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
      .lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
      .stroke({ width: major ? 4 : 2, color: i > 15 ? COLORS.neon : COLORS.tealDeep, cap: 'round' });
  }
  c.addChild(ticks);

  // The handle, resting at zero power.
  const handle = new Graphics()
    .roundRect(-13, -radius + 30, 26, radius - 20, 13)
    .fill(chrome(false))
    .circle(0, -radius + 34, 21)
    .fill(COLORS.neon)
    .circle(-6, -radius + 28, 6)
    .fill({ color: 0xffffff, alpha: 0.45 })
    .circle(0, 0, 34)
    .fill(chrome())
    .circle(0, 0, 34)
    .stroke({ width: 2, color: 0x3c4348, alpha: 0.7 })
    .circle(0, 0, 12)
    .fill(COLORS.ink);
  handle.position.set(cx, cy);
  handle.rotation = from + Math.PI / 2;
  c.addChild(handle);

  const label = new Text({
    text: 'POWER',
    style: { fontFamily: FONT_STACK, fontSize: 24, fontWeight: '700', fill: COLORS.cream, letterSpacing: 6 },
  });
  label.anchor.set(0.5);
  label.position.set(cx + 3, cy + radius + 36);
  c.addChild(label);
  return c;
}

/** The whole machine, drawn in design units. Scale and position it with `fitCabinet`. */
export class Cabinet extends Container {
  readonly ballsRemaining = new LedCounter('BALLS REMAINING');
  readonly ballsAwarded = new LedCounter('BALLS AWARDED');
  readonly highScore = new LedCounter('HIGH SCORE');

  constructor() {
    super();

    // Cabinet body.
    this.addChild(
      new Graphics().roundRect(4, 8, DESIGN_W - 8, DESIGN_H - 8, 50).fill({ color: 0x000000, alpha: 0.5 }),
      woodSlab(0, 0, DESIGN_W, DESIGN_H, 48, COLORS.wood, false, 7),
      new Graphics()
        .roundRect(1, 1, DESIGN_W - 2, DESIGN_H - 2, 47)
        .stroke({ width: 3, color: COLORS.woodDark })
        .roundRect(14, 14, DESIGN_W - 28, DESIGN_H - 28, 38)
        .stroke({ width: 4, fill: chrome() }),
    );

    this.addChild(buildHeader(), buildPlayfield());

    // Control panel.
    const p = CONTROL_PANEL;
    this.addChild(
      new Graphics().roundRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8, 34).fill(chrome()),
      woodSlab(p.x, p.y, p.w, p.h, 30, COLORS.woodPanel, true, 23),
      new Graphics().roundRect(p.x, p.y, p.w, p.h, 30).stroke({ width: 3, color: 0x000000, alpha: 0.35 }),
    );

    const counters = [this.ballsRemaining, this.ballsAwarded, this.highScore];
    counters.forEach((counter, i) => {
      counter.position.set(p.x + 44, p.y + 26 + i * 152);
      this.addChild(counter);
    });

    this.addChild(buildLever());

    const inset = 34;
    const corners: [number, number][] = [
      [inset, inset],
      [DESIGN_W - inset, inset],
      [inset, DESIGN_H - inset],
      [DESIGN_W - inset, DESIGN_H - inset],
    ];
    corners.forEach(([x, y], i) => this.addChild(screw(x, y, 0.5 + i * 1.1)));
  }

  /** Push the latest numbers to the LED counters. */
  show(state: GameState): void {
    this.ballsRemaining.value = state.ballsRemaining;
    this.ballsAwarded.value = state.ballsAwarded;
    this.highScore.value = state.highScore;
  }
}
