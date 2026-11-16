import { Container, FillGradient, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';
import type { Board } from '../board/types';
import type { Ball } from '../physics/sim';
import { COLORS } from '../theme';
import { chrome, seeded } from './draw';

/** Draws a board (in board units, origin at the playfield centre) and the balls on it. */
export class BoardView extends Container {
  private readonly ballLayer = new Container();
  private readonly sprites: Sprite[] = [];
  private ballTexture: Texture | null = null;

  constructor(
    private readonly board: Board,
    private readonly renderer: Renderer,
  ) {
    super();
    this.addChild(this.buildFace(), this.buildFlowers(), this.buildOutHole(), this.buildRails(), this.buildPins(), this.ballLayer, this.buildGlass());
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
