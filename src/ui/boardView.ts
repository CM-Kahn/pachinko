import { Container, FillGradient, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';
import { WINDMILL_BLADES, pocketOutline, tigerCircles } from '../board/shapes';
import type { Board, Pocket } from '../board/types';
import type { Machine } from '../game/machine';
import type { Ball } from '../physics/sim';
import { COLORS } from '../theme';
import { chrome, seeded } from './draw';

const INK = 0x3a2416;
const TIGER = { fur: 0xf4a23c, furShade: 0xd9822a, cream: 0xfff1d6, nose: 0xf07f86, blush: 0xf59a84, mouth: 0x8c2f2a, tongue: 0xf59aa0 };
const TULIP = { petal: 0xe9574a, rib: 0xf79a86, inside: 0x2a1410, line: 0x7a231c, housing: 0xf3ead2 };

export class BoardView extends Container {
  private readonly ballLayer = new Container();
  private readonly sprites: Sprite[] = [];
  private ballTexture: Texture | null = null;
  private readonly catchers = new Graphics();
  private readonly tigerFace = new Graphics();
  /** The pins the luck setting moves. */
  private readonly gatePins = new Graphics();
  private gateKey = '';
  private readonly mills: Graphics[] = [];
  private catcherKey = '';
  private faceKey = '';

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
      this.gatePins,
      this.ballLayer,
      this.buildGlass(),
    );
  }

  /**
   * The tiger in the middle of the board: a moulded face. His jaw and cheek lamps are drawn
   * separately because they move and light, as they would on a real machine.
   */
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
    wedge(0, -r + 16, 0, -r + 40, 5.5);
    wedge(-19, -r + 14, -16, -r + 31, 4.5);
    wedge(19, -r + 14, 16, -r + 31, 4.5);
    for (const side of [-1, 1]) {
      wedge(side * (r - 3), -8, side * (r - 30), -3, 5.5);
      wedge(side * (r - 9), 16, side * (r - 33), 14, 5);
    }

    // Cream muzzle.
    g.circle(head.x - 19, head.y + 30, 25).circle(head.x + 19, head.y + 30, 25).circle(head.x, head.y + 44, 22).fill(TIGER.cream);
    // Eyes: fixed, glossy domes.
    for (const side of [-1, 1]) {
      const ex = head.x + side * 30;
      const ey = head.y - 14;
      g.ellipse(ex, ey, 10.5, 12.5).fill(INK);
      g.circle(ex - 3.5, ey - 5, 4.2).circle(ex + 3.5, ey + 4.5, 2).fill(0xffffff);
    }

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

  /** The moving parts of the face: the hinged jaw, and the lamps behind his cheeks. */
  private drawExpression(cheering: boolean): void {
    const t = this.board.tiger;
    const g = this.tigerFace.clear();
    for (const side of [-1, 1]) {
      const cx = t.x + side * 50;
      const cy = t.y + 16;
      if (cheering) {
        g.circle(cx, cy, 16).fill({ color: 0xffd45e, alpha: 0.35 });
        g.circle(cx, cy, 10).fill(0xffc94a).circle(cx - 3, cy - 3, 3).fill({ color: 0xffffff, alpha: 0.8 });
      } else {
        g.circle(cx, cy, 10).fill({ color: TIGER.blush, alpha: 0.6 });
      }
    }
    const my = t.y + 24;
    if (cheering) {
      // The jaw drops open.
      g.moveTo(t.x - 17, my + 4).quadraticCurveTo(t.x, my + 1, t.x + 17, my + 4).quadraticCurveTo(t.x + 13, my + 27, t.x, my + 28).quadraticCurveTo(t.x - 13, my + 27, t.x - 17, my + 4).fill(TIGER.mouth);
      g.ellipse(t.x, my + 21, 8, 5.5).fill(TIGER.tongue);
      g.moveTo(t.x - 17, my + 4).quadraticCurveTo(t.x, my + 1, t.x + 17, my + 4).quadraticCurveTo(t.x + 13, my + 27, t.x, my + 28).quadraticCurveTo(t.x - 13, my + 27, t.x - 17, my + 4).stroke({ width: 2.2, color: INK, join: 'round' });
    } else {
      // Jaw shut: a gentle cat smile.
      g.moveTo(t.x, my).lineTo(t.x, my + 5);
      g.moveTo(t.x - 15, my + 5).quadraticCurveTo(t.x - 8, my + 14, t.x, my + 5).quadraticCurveTo(t.x + 8, my + 14, t.x + 15, my + 5);
      g.stroke({ width: 2.4, color: INK, cap: 'round', join: 'round' });
    }
  }

  /** Traditional round windmills: a wheel with raised vanes that balls catch and turn. */
  private buildWindmills(): Container {
    const layer = new Container();
    const r = this.board.windmillRadius;
    for (const w of this.board.windmills) {
      const g = new Graphics();
      g.circle(0, 0, r + 1).fill(COLORS.cream).circle(0, 0, r + 1).stroke({ width: 2.2, color: INK });
      g.circle(0, 0, r - 4).stroke({ width: 3, color: COLORS.turquoise });
      for (let k = 0; k < WINDMILL_BLADES; k++) {
        const a = (k / WINDMILL_BLADES) * Math.PI * 2;
        const mid = a + Math.PI / WINDMILL_BLADES;
        g.circle(Math.cos(mid) * (r - 9), Math.sin(mid) * (r - 9), 2.6).fill(COLORS.mustard);
        const c = Math.cos(a);
        const sn = Math.sin(a);
        const bar = [4 * c + 3 * sn, 4 * sn - 3 * c, r * c + 2.5 * sn, r * sn - 2.5 * c, r * c - 2.5 * sn, r * sn + 2.5 * c, 4 * c - 3 * sn, 4 * sn + 3 * c];
        g.poly(bar).fill(COLORS.coral);
        g.poly(bar).stroke({ width: 1.4, color: INK, join: 'round' });
      }
      g.circle(0, 0, 6.5).fill(chrome()).circle(0, 0, 6.5).stroke({ width: 1.5, color: INK }).circle(0, 0, 2).fill(INK);
      g.position.set(w.x, w.y);
      const shadow = new Graphics().circle(w.x + 2, w.y + 4, r + 1).fill({ color: 0x000000, alpha: 0.14 });
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

  /**
   * A tulip as the mechanism it is: a housing set in the board, and two rigid petals hinged
   * on pivots at its floor that swing outwards to open.
   */
  private drawTulip(g: Graphics, pocket: Pocket, open: boolean): void {
    const { x, y } = pocket;
    const [tipL, baseL, baseR, tipR] = pocketOutline(pocket, open) as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
    const by = y + baseL.y;

    // Housing: the throat the ball drops into, and the body below it.
    g.roundRect(x - 17, by - 6 + 3, 34, 26, 8).fill({ color: 0x000000, alpha: 0.16 });
    g.roundRect(x - 17, by - 6, 34, 25, 8).fill(TULIP.housing);
    g.roundRect(x - 17, by - 6, 34, 25, 8).stroke({ width: 2.6, color: INK, join: 'round' });
    g.roundRect(x - 11, by + 7, 22, 5, 2.5).fill(COLORS.turquoise);
    g.poly([x + tipL.x, y + tipL.y, x + baseL.x, by, x + baseR.x, by, x + tipR.x, y + tipR.y]).fill(TULIP.inside);

    // Petals: the inner edge is the wall the ball meets; the body of the flap lies outside it.
    for (const [tip, base, side] of [
      [tipL, baseL, -1],
      [tipR, baseR, 1],
    ] as const) {
      const px = x + base.x;
      const py = by;
      const dx = tip.x - base.x;
      const dy = tip.y - base.y;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      // The normal of the flap that points away from the middle of the tulip.
      const flip = uy * side > 0 ? 1 : -1;
      const nx = uy * flip;
      const ny = -ux * flip;
      const at = (along: number, out: number): [number, number] => [px + ux * along + nx * out, py + uy * along + ny * out];
      const shape = (): void => {
        const [ax, ay] = at(-3, 0);
        const [bx, bY] = at(len + 3, 0);
        const [c1x, c1y] = at(len * 0.75, 12);
        const [c2x, c2y] = at(len * 0.1, 11);
        g.moveTo(ax, ay).lineTo(bx, bY).quadraticCurveTo(c1x, c1y, ...at(len * 0.4, 9)).quadraticCurveTo(c2x, c2y, ax, ay).closePath();
      };
      shape();
      g.fill(TULIP.petal);
      shape();
      g.stroke({ width: 2.2, color: TULIP.line, join: 'round' });
      // A moulded rib along the flap, and the pivot it swings on.
      g.moveTo(...at(len * 0.2, 4)).lineTo(...at(len * 0.85, 3.5)).stroke({ width: 1.8, color: TULIP.rib, cap: 'round' });
      g.circle(px, py, 3.4).fill(chrome()).circle(px, py, 3.4).stroke({ width: 1.4, color: INK });
    }
  }

  /** Bring the tiger, catchers, windmills and adjustable pins up to date. */
  update(machine: Machine, windmills: readonly { rotation: number }[], gatePins: readonly { x: number; y: number }[]): void {
    const gateKey = gatePins.map((p) => p.x.toFixed(1)).join(',');
    if (gateKey !== this.gateKey) {
      this.gateKey = gateKey;
      this.drawPins(this.gatePins.clear(), gatePins);
    }

    const key = this.board.pockets.map((p) => (machine.isOpen(p.id) ? 1 : 0)).join('');
    if (key !== this.catcherKey) {
      this.catcherKey = key;
      this.drawCatchers(machine);
    }

    const face = machine.cheer > 0 ? 'cheer' : 'rest';
    if (face !== this.faceKey) {
      this.faceKey = face;
      this.drawExpression(face === 'cheer');
    }

    this.mills.forEach((g, i) => (g.rotation = windmills[i]?.rotation ?? 0));
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
    return this.drawPins(new Graphics(), this.board.pins);
  }

  private drawPins(g: Graphics, pins: readonly { x: number; y: number }[]): Graphics {
    const r = this.board.pinRadius;
    for (const p of pins) g.circle(p.x + 2.5, p.y + 4, r + 0.5);
    g.fill({ color: 0x3a2a10, alpha: 0.28 });
    for (const p of pins) g.circle(p.x, p.y, r + 0.8);
    g.fill(COLORS.brassDark);
    for (const p of pins) g.circle(p.x, p.y, r);
    g.fill(COLORS.brass);
    for (const p of pins) g.circle(p.x - r * 0.3, p.y - r * 0.35, r * 0.42);
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
