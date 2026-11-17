import { Container, FillGradient, Graphics, Sprite, Text, type Renderer, type Texture } from 'pixi.js';
import { WINDMILL_BLADES, pocketOutline, tigerCircles } from '../board/shapes';
import type { Board, Pocket } from '../board/types';
import type { Machine } from '../game/machine';
import type { Ball } from '../physics/sim';
import { COLORS, FONT_STACK } from '../theme';
import { chrome, seeded } from './draw';

const INK = 0x3a2416;
const TIGER = { fur: 0xf4a23c, furShade: 0xd9822a, cream: 0xfff1d6, nose: 0xf07f86, blush: 0xf59a84, mouth: 0x8c2f2a, tongue: 0xf59aa0 };
const TULIP = { petal: 0xe9574a, petalLight: 0xf58b76, back: 0xc23c34, inside: 0x3d1512, line: 0x7a231c, stem: 0x5c9160, leaf: 0x7fb37a };

export class BoardView extends Container {
  private readonly ballLayer = new Container();
  private readonly sprites: Sprite[] = [];
  private ballTexture: Texture | null = null;
  private readonly catchers = new Graphics();
  private readonly tigerFace = new Graphics();
  private readonly mills: Graphics[] = [];
  private readonly popups: { text: Text; age: number }[] = [];
  private readonly popupLayer = new Container();
  private catcherKey = '';
  private faceKey = '';
  private clock = 0;

  constructor(
    private readonly board: Board,
    private readonly renderer: Renderer,
  ) {
    super();
    this.addChild(
      this.buildFace(),
      this.buildFlowers(),
      this.buildOutHole(),
      this.buildRails(),
      this.buildTiger(),
      this.catchers,
      this.buildWindmills(),
      this.buildPins(),
      this.ballLayer,
      this.popupLayer,
      this.buildGlass(),
    );
  }

  /** The tiger in the middle of the board. His expression is drawn separately so it can change. */
  private buildTiger(): Container {
    const t = this.board.tiger;
    const [head, earL, earR] = tigerCircles(t) as [{ x: number; y: number; r: number }, { x: number; y: number; r: number }, { x: number; y: number; r: number }];
    const c = new Container();
    const g = new Graphics();
    const r = head.r;

    // Soft shadow on the board.
    g.circle(head.x + 3, head.y + 6, r + 2).fill({ color: 0x000000, alpha: 0.18 });
    for (const ear of [earL, earR]) {
      const side = Math.sign(ear.x - head.x);
      g.circle(ear.x, ear.y, ear.r).fill(TIGER.fur).circle(ear.x, ear.y, ear.r).stroke({ width: 3.5, color: INK });
      g.circle(ear.x - side * 3, ear.y + 4, ear.r * 0.55).fill(TIGER.blush);
    }
    g.circle(head.x, head.y, r).fill(
      new FillGradient({
        type: 'radial',
        center: { x: 0.42, y: 0.34 },
        innerRadius: 0,
        outerCenter: { x: 0.5, y: 0.5 },
        outerRadius: 0.5,
        colorStops: [
          { offset: 0, color: 0xfdb656 },
          { offset: 0.7, color: TIGER.fur },
          { offset: 1, color: TIGER.furShade },
        ],
        textureSpace: 'local',
      }),
    );

    // The slot in the top of his head, between the ears.
    g.ellipse(head.x, head.y - r + 7, 15, 7).fill(0x1d1510).ellipse(head.x, head.y - r + 7, 15, 7).stroke({ width: 2.5, color: COLORS.mustard });

    // Stripes: three on the forehead and two on each cheek, each a tapered wedge.
    const wedge = (x1: number, y1: number, x2: number, y2: number, w: number): void => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      const nx = (-dy / len) * w;
      const ny = (dx / len) * w;
      g.moveTo(head.x + x1 + nx, head.y + y1 + ny)
        .quadraticCurveTo(head.x + (x1 + x2) / 2 + nx * 0.8, head.y + (y1 + y2) / 2 + ny * 0.8, head.x + x2, head.y + y2)
        .quadraticCurveTo(head.x + (x1 + x2) / 2 - nx * 0.8, head.y + (y1 + y2) / 2 - ny * 0.8, head.x + x1 - nx, head.y + y1 - ny)
        .closePath()
        .fill(INK);
    };
    wedge(0, -r + 16, 0, -r + 42, 5.5);
    wedge(-21, -r + 13, -15, -r + 36, 5);
    wedge(21, -r + 13, 15, -r + 36, 5);
    for (const side of [-1, 1]) {
      wedge(side * (r - 3), -8, side * (r - 30), -3, 5.5);
      wedge(side * (r - 9), 16, side * (r - 33), 14, 5);
    }

    // Cream muzzle and brow spots.
    g.circle(head.x - 19, head.y + 30, 25).circle(head.x + 19, head.y + 30, 25).circle(head.x, head.y + 44, 22).fill(TIGER.cream);
    g.ellipse(head.x - 31, head.y - 36, 9, 6).ellipse(head.x + 31, head.y - 36, 9, 6).fill(TIGER.cream);
    // Rosy cheeks.
    g.circle(head.x - 50, head.y + 16, 10).circle(head.x + 50, head.y + 16, 10).fill({ color: TIGER.blush, alpha: 0.6 });

    // Whiskers.
    for (const side of [-1, 1]) {
      for (const [dy, tilt] of [
        [22, -7],
        [30, 0],
        [38, 7],
      ] as const) {
        g.moveTo(head.x + side * 30, head.y + dy).lineTo(head.x + side * 66, head.y + dy + tilt);
      }
    }
    g.stroke({ width: 1.6, color: INK, alpha: 0.75, cap: 'round' });

    // Nose.
    g.moveTo(head.x - 9, head.y + 12)
      .quadraticCurveTo(head.x, head.y + 8, head.x + 9, head.y + 12)
      .quadraticCurveTo(head.x + 7, head.y + 22, head.x, head.y + 24)
      .quadraticCurveTo(head.x - 7, head.y + 22, head.x - 9, head.y + 12)
      .fill(TIGER.nose);
    g.moveTo(head.x - 9, head.y + 12)
      .quadraticCurveTo(head.x, head.y + 8, head.x + 9, head.y + 12)
      .quadraticCurveTo(head.x + 7, head.y + 22, head.x, head.y + 24)
      .quadraticCurveTo(head.x - 7, head.y + 22, head.x - 9, head.y + 12)
      .stroke({ width: 2, color: INK, join: 'round' });

    g.circle(head.x, head.y, r).stroke({ width: 3.5, color: INK });
    c.addChild(g, this.tigerFace);
    return c;
  }

  /** Eyes and mouth. `mood` is 'calm', 'blink' or 'happy'. */
  private drawExpression(mood: 'calm' | 'blink' | 'happy'): void {
    const t = this.board.tiger;
    const g = this.tigerFace.clear();
    const ex = 30;
    const ey = t.y - 14;
    for (const side of [-1, 1]) {
      const x = t.x + side * ex;
      if (mood === 'calm') {
        g.ellipse(x, ey, 10.5, 12.5).fill(INK);
        g.circle(x - 3.5, ey - 5, 4.2).circle(x + 3.5, ey + 4.5, 2).fill(0xffffff);
      } else if (mood === 'blink') {
        g.moveTo(x - 10, ey + 1).quadraticCurveTo(x, ey + 6, x + 10, ey + 1).stroke({ width: 4, color: INK, cap: 'round' });
      } else {
        // Smiling eyes: upward arcs.
        g.moveTo(x - 11, ey + 4).quadraticCurveTo(x, ey - 13, x + 11, ey + 4).stroke({ width: 4.5, color: INK, cap: 'round' });
      }
    }
    const my = t.y + 24;
    if (mood === 'happy') {
      // Open, laughing mouth with a tongue.
      g.moveTo(t.x - 17, my + 4).quadraticCurveTo(t.x, my + 1, t.x + 17, my + 4).quadraticCurveTo(t.x + 13, my + 27, t.x, my + 28).quadraticCurveTo(t.x - 13, my + 27, t.x - 17, my + 4).fill(TIGER.mouth);
      g.ellipse(t.x, my + 21, 8, 5.5).fill(TIGER.tongue);
      g.moveTo(t.x - 17, my + 4).quadraticCurveTo(t.x, my + 1, t.x + 17, my + 4).quadraticCurveTo(t.x + 13, my + 27, t.x, my + 28).quadraticCurveTo(t.x - 13, my + 27, t.x - 17, my + 4).stroke({ width: 2.2, color: INK, join: 'round' });
    } else {
      // A gentle cat smile.
      g.moveTo(t.x, my).lineTo(t.x, my + 5);
      g.moveTo(t.x - 15, my + 5).quadraticCurveTo(t.x - 8, my + 14, t.x, my + 5).quadraticCurveTo(t.x + 8, my + 14, t.x + 15, my + 5);
      g.stroke({ width: 2.4, color: INK, cap: 'round', join: 'round' });
    }
  }

  private buildWindmills(): Container {
    const layer = new Container();
    const r = this.board.windmillRadius;
    const inks = [COLORS.coral, COLORS.turquoise, COLORS.mustard, COLORS.cream];
    for (const w of this.board.windmills) {
      const g = new Graphics();
      for (let k = 0; k < WINDMILL_BLADES; k++) {
        const a = (k / WINDMILL_BLADES) * Math.PI * 2;
        const tip = { x: Math.cos(a) * r, y: Math.sin(a) * r };
        const side = { x: Math.cos(a + 1.05) * r * 0.95, y: Math.sin(a + 1.05) * r * 0.95 };
        const other = { x: Math.cos(a - 0.1) * r * 0.5, y: Math.sin(a - 0.1) * r * 0.5 };
        g.moveTo(0, 0).quadraticCurveTo(side.x, side.y, tip.x, tip.y).quadraticCurveTo(other.x, other.y, 0, 0).fill(inks[k % inks.length]!);
        g.moveTo(0, 0).quadraticCurveTo(side.x, side.y, tip.x, tip.y).quadraticCurveTo(other.x, other.y, 0, 0).stroke({ width: 1.8, color: INK, join: 'round' });
      }
      g.circle(0, 0, 5.5).fill(chrome()).circle(0, 0, 5.5).stroke({ width: 1.5, color: INK });
      g.position.set(w.x, w.y);
      const shadow = new Graphics().circle(w.x + 2, w.y + 4, r * 0.8).fill({ color: 0x000000, alpha: 0.12 });
      layer.addChild(shadow, g);
      this.mills.push(g);
    }
    return layer;
  }

  private drawCatchers(machine: Machine): void {
    const g = this.catchers.clear();
    for (const pocket of this.board.pockets) {
      const { x, y, halfWidth: hw } = pocket;
      if (pocket.kind === 'crown') continue;
      if (pocket.kind === 'tulip') {
        this.drawTulip(g, pocket, machine.isOpen(pocket.id));
        continue;
      }
      // A rounded cup: a mitt for a paw, a little gold pot under the chin, enamel for the sides.
      const body = pocket.kind === 'paw' ? TIGER.fur : pocket.kind === 'chin' ? COLORS.mustard : COLORS.teal;
      const round = pocket.kind === 'paw' ? 13 : 9;
      g.roundRect(x - hw - 2, y - 11 + 3, (hw + 2) * 2, 30, round).fill({ color: 0x000000, alpha: 0.16 });
      g.roundRect(x - hw - 3, y - 12, (hw + 3) * 2, 31, round).fill(body);
      g.roundRect(x - hw - 3, y - 12, (hw + 3) * 2, 31, round).stroke({ width: 3, color: INK, join: 'round' });
      g.ellipse(x, y - 6, hw - 2, 5).fill(0x1d1510).ellipse(x, y - 6, hw - 2, 5).stroke({ width: 2, color: INK });
      if (pocket.kind === 'paw') {
        // Toe beans and a pad.
        g.circle(x - 9, y + 5, 3.4).circle(x, y + 3.5, 3.6).circle(x + 9, y + 5, 3.4).ellipse(x, y + 12, 7, 4).fill(TIGER.cream);
      } else if (pocket.kind === 'chin') {
        // A paw print, so it reads as the tiger's own.
        g.circle(x - 6, y + 5, 2.4).circle(x, y + 3.5, 2.6).circle(x + 6, y + 5, 2.4).ellipse(x, y + 11, 5, 3.2).fill({ color: INK, alpha: 0.7 });
      } else {
        g.roundRect(x - hw, y + 4, hw * 2, 6, 3).fill(COLORS.cream);
      }
    }
  }

  /** A tulip: stem and leaves, a back petal, and two front petals that splay when it opens. */
  private drawTulip(g: Graphics, pocket: Pocket, open: boolean): void {
    const { x, y } = pocket;
    const [tipL, baseL, baseR, tipR] = pocketOutline(pocket, open) as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
    const by = y + baseL.y;

    // Stem and leaves.
    g.moveTo(x, by + 2).lineTo(x, by + 30).stroke({ width: 5, color: TULIP.stem, cap: 'round' });
    for (const side of [-1, 1]) {
      g.moveTo(x, by + 26)
        .quadraticCurveTo(x + side * 8, by + 8, x + side * 24, by + 6)
        .quadraticCurveTo(x + side * 20, by + 24, x, by + 26)
        .fill(TULIP.leaf);
      g.moveTo(x, by + 26)
        .quadraticCurveTo(x + side * 8, by + 8, x + side * 24, by + 6)
        .quadraticCurveTo(x + side * 20, by + 24, x, by + 26)
        .stroke({ width: 1.8, color: 0x3f6b45, join: 'round' });
    }

    // Back petal, then the dark inside of the cup.
    const peak = open ? -14 : -24;
    g.moveTo(x + tipL.x * 0.75, y + tipL.y + 6)
      .quadraticCurveTo(x, y + peak - 8, x + tipR.x * 0.75, y + tipR.y + 6)
      .lineTo(x + baseR.x, by)
      .lineTo(x + baseL.x, by)
      .closePath()
      .fill(TULIP.back);
    g.poly([x + tipL.x, y + tipL.y, x + baseL.x, by, x + baseR.x, by, x + tipR.x, y + tipR.y]).fill(TULIP.inside);

    // Front petals: each a pointed leaf from the base out to the tip.
    for (const [tip, side] of [
      [tipL, -1],
      [tipR, 1],
    ] as const) {
      const tx = x + tip.x;
      const ty = y + tip.y - 6;
      const shape = (): void => {
        g.moveTo(x, by + 4)
          .quadraticCurveTo(x + side * (Math.abs(tip.x) + 9), by + 2, tx, ty)
          .quadraticCurveTo(x + tip.x * 0.45, y + 2, x + side * 3, by + 4)
          .closePath();
      };
      shape();
      g.fill(open ? TULIP.petalLight : TULIP.petal);
      shape();
      g.stroke({ width: 2.4, color: TULIP.line, join: 'round' });
      // A soft highlight along the outer edge.
      g.moveTo(x + side * (Math.abs(tip.x) * 0.55 + 5), by - 3)
        .quadraticCurveTo(x + side * (Math.abs(tip.x) + 2), by - 6, tx - side * 1.5, ty + 7)
        .stroke({ width: 1.6, color: 0xffd9c8, alpha: 0.8, cap: 'round' });
    }
  }

  /** A little "+5" that floats up from a catcher when it pays. */
  popup(pocket: Pocket, balls: number): void {
    this.floatText(pocket.x, pocket.y - 16, `+${balls}`, 26);
  }

  /** The tiger announces what a ball in one of his pockets has done. */
  announce(text: string): void {
    const t = this.board.tiger;
    this.floatText(t.x, t.y - t.radius - 40, text, 34);
  }

  private floatText(x: number, y: number, message: string, size: number): void {
    const text = new Text({
      text: message,
      style: { fontFamily: FONT_STACK, fontSize: size, fontWeight: '800', fill: COLORS.neon, stroke: { color: 0xfff6e0, width: 5, join: 'round' }, letterSpacing: 1 },
    });
    text.anchor.set(0.5);
    text.position.set(x, y);
    this.popupLayer.addChild(text);
    this.popups.push({ text, age: 0 });
  }

  /** Bring the tiger, catchers, windmills and pop-ups up to date. */
  update(dt: number, machine: Machine, windmills: readonly { rotation: number }[]): void {
    this.clock += dt;

    const key = this.board.pockets.map((p) => (machine.isOpen(p.id) ? 1 : 0)).join('');
    if (key !== this.catcherKey) {
      this.catcherKey = key;
      this.drawCatchers(machine);
    }

    // He blinks now and then, and beams when a ball finds him.
    const mood = machine.cheer > 0 ? 'happy' : this.clock % 4.2 < 0.14 ? 'blink' : 'calm';
    if (mood !== this.faceKey) {
      this.faceKey = mood;
      this.drawExpression(mood);
    }

    this.mills.forEach((g, i) => (g.rotation = windmills[i]?.rotation ?? 0));

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i]!;
      p.age += dt;
      p.text.y -= dt * 46;
      p.text.alpha = Math.max(0, 1 - p.age / 1.1);
      if (p.age > 1.1) {
        p.text.destroy();
        this.popups.splice(i, 1);
      }
    }
  }

  private buildFace(): Graphics {
    const r = this.board.radius;
    return new Graphics()
      .circle(0, 5, r + 20)
      .fill({ color: 0x000000, alpha: 0.22 })
      .circle(0, 0, r + 18)
      .fill(chrome(false))
      .circle(0, 0, r + 5)
      .fill(COLORS.ink)
      .circle(0, 0, r)
      .fill(
        new FillGradient({
          type: 'radial',
          center: { x: 0.5, y: 0.42 },
          innerRadius: 0,
          outerCenter: { x: 0.5, y: 0.5 },
          outerRadius: 0.5,
          colorStops: [
            { offset: 0, color: 0xfaf3df },
            { offset: 0.75, color: COLORS.cream },
            { offset: 1, color: COLORS.creamShade },
          ],
          textureSpace: 'local',
        }),
      );
  }

  /** Faded mid-century daisies printed on the board face. */
  private buildFlowers(): Container {
    const layer = new Container();
    const g = new Graphics();
    const rand = seeded(41);
    const r = this.board.radius;
    const inks = [COLORS.sage, COLORS.mustard, COLORS.coral, COLORS.sky];
    const spots: { x: number; y: number; size: number }[] = [];
    for (let tries = 0; tries < 400 && spots.length < 15; tries++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * (r - 70);
      const size = 46 + rand() * 60;
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d;
      if (spots.some((s) => Math.hypot(s.x - x, s.y - y) < (s.size + size) * 0.95)) continue;
      spots.push({ x, y, size });
    }
    spots.forEach((s, i) => {
      const ink = inks[i % inks.length]!;
      const petals = 5 + (i % 3);
      const turn = rand() * Math.PI;
      for (let p = 0; p < petals; p++) {
        const a = turn + (p / petals) * Math.PI * 2;
        const px = s.x + Math.cos(a) * s.size * 0.52;
        const py = s.y + Math.sin(a) * s.size * 0.52;
        // Each petal is an ellipse turned to point away from the flower's centre.
        const pts: number[] = [];
        for (let k = 0; k < 14; k++) {
          const t = (k / 14) * Math.PI * 2;
          const ex = Math.cos(t) * s.size * 0.46;
          const ey = Math.sin(t) * s.size * 0.24;
          pts.push(px + ex * Math.cos(a) - ey * Math.sin(a), py + ex * Math.sin(a) + ey * Math.cos(a));
        }
        g.poly(pts).fill({ color: ink, alpha: 0.3 });
      }
      g.circle(s.x, s.y, s.size * 0.2).fill({ color: i % 2 ? COLORS.mustard : COLORS.cream, alpha: 0.55 });
    });
    layer.addChild(g);
    const clip = new Graphics().circle(0, 0, r - 1).fill(0xffffff);
    layer.addChild(clip);
    layer.mask = clip;
    return layer;
  }

  private buildOutHole(): Graphics {
    const d = this.board.drain;
    const g = new Graphics();
    g.roundRect(d.x - d.halfWidth - 14, d.y - 22, (d.halfWidth + 14) * 2, 34, 14).fill(chrome());
    g.roundRect(d.x - d.halfWidth - 4, d.y - 14, (d.halfWidth + 4) * 2, 22, 10).fill(0x0b0907);
    return g;
  }

  private buildRails(): Graphics {
    const g = new Graphics();
    const rail = this.board.rail;
    const trace = (): void => {
      rail.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
    };
    trace();
    g.stroke({ width: 7, color: 0x4a5258, cap: 'round', join: 'round' });
    trace();
    g.stroke({ width: 4, color: 0xdfe4e8, cap: 'round', join: 'round' });
    trace();
    g.stroke({ width: 1.5, color: 0xffffff, alpha: 0.9, cap: 'round', join: 'round' });

    for (const b of this.board.bumpers) {
      g.circle(b.x + 1, b.y + 3, b.radius + 1).fill({ color: 0x000000, alpha: 0.25 });
      g.circle(b.x, b.y, b.radius).fill(COLORS.neon);
      g.circle(b.x, b.y, b.radius).stroke({ width: 2, color: 0x8c2f24 });
      g.circle(b.x, b.y, b.radius * 0.45).fill(chrome());
      g.circle(b.x - b.radius * 0.35, b.y - b.radius * 0.4, b.radius * 0.2).fill({ color: 0xffffff, alpha: 0.5 });
    }
    return g;
  }

  private buildPins(): Graphics {
    const g = new Graphics();
    const r = this.board.pinRadius;
    for (const p of this.board.pins) g.circle(p.x + 2.5, p.y + 4, r + 0.5);
    g.fill({ color: 0x3a2a10, alpha: 0.28 });
    for (const p of this.board.pins) g.circle(p.x, p.y, r + 0.8);
    g.fill(COLORS.brassDark);
    for (const p of this.board.pins) g.circle(p.x, p.y, r);
    g.fill(COLORS.brass);
    for (const p of this.board.pins) g.circle(p.x - r * 0.3, p.y - r * 0.35, r * 0.42);
    g.fill({ color: 0xfff6d8, alpha: 0.9 });
    return g;
  }

  private buildGlass(): Graphics {
    const r = this.board.radius;
    return new Graphics()
      .arc(0, 0, r - 14, Math.PI * 1.08, Math.PI * 1.45)
      .stroke({ width: 10, color: 0xffffff, alpha: 0.16, cap: 'round' })
      .arc(0, 0, r - 34, Math.PI * 1.14, Math.PI * 1.34)
      .stroke({ width: 5, color: 0xffffff, alpha: 0.12, cap: 'round' });
  }

  private texture(): Texture {
    if (this.ballTexture) return this.ballTexture;
    const r = this.board.ballRadius;
    const g = new Graphics()
      .circle(0, 0, r)
      .fill(
        new FillGradient({
          type: 'radial',
          center: { x: 0.36, y: 0.32 },
          innerRadius: 0,
          outerCenter: { x: 0.5, y: 0.5 },
          outerRadius: 0.5,
          colorStops: [
            { offset: 0, color: 0xffffff },
            { offset: 0.25, color: 0xd9dee2 },
            { offset: 0.7, color: 0x7d868d },
            { offset: 1, color: 0x353b40 },
          ],
          textureSpace: 'local',
        }),
      )
      .circle(0, 0, r - 0.5)
      .stroke({ width: 1, color: 0x20252a, alpha: 0.8 })
      .circle(r * 0.3, r * 0.42, r * 0.22)
      .fill({ color: 0xffffff, alpha: 0.22 });
    this.ballTexture = this.renderer.generateTexture({ target: g, resolution: 4, antialias: true });
    g.destroy();
    return this.ballTexture;
  }

  /** Move the ball sprites to match the simulation. */
  sync(balls: readonly Ball[]): void {
    while (this.sprites.length < balls.length) {
      const s = new Sprite(this.texture());
      s.anchor.set(0.5);
      s.width = s.height = this.board.ballRadius * 2 + 1;
      this.sprites.push(s);
      this.ballLayer.addChild(s);
    }
    for (let i = 0; i < this.sprites.length; i++) {
      const s = this.sprites[i]!;
      const b = balls[i];
      s.visible = b !== undefined;
      if (b) s.position.set(b.x, b.y);
    }
  }
}
