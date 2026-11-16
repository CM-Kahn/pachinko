import { Container, FillGradient, Graphics, Sprite, Text, type Renderer, type Texture } from 'pixi.js';
import { pocketOutline } from '../board/shapes';
import type { Board, Pocket } from '../board/types';
import type { Machine } from '../game/machine';
import type { Ball } from '../physics/sim';
import { COLORS, FONT_STACK } from '../theme';
import { chrome, seeded } from './draw';

/** Draws a board (in board units, origin at the playfield centre) and the balls on it. */
export class BoardView extends Container {
  private readonly ballLayer = new Container();
  private readonly sprites: Sprite[] = [];
  private ballTexture: Texture | null = null;
  private readonly catchers = new Graphics();
  private readonly screenGlow = new Graphics();
  private readonly reelTexts: Text[] = [];
  private readonly status: Text;
  private readonly spinLamps = new Graphics();
  private readonly popups: { text: Text; age: number }[] = [];
  private readonly popupLayer = new Container();
  private catcherKey = '';
  private lampKey = '';
  private clock = 0;

  constructor(
    private readonly board: Board,
    private readonly renderer: Renderer,
  ) {
    super();
    this.status = new Text({ text: '', style: { fontFamily: FONT_STACK, fontSize: 17, fontWeight: '800', fill: COLORS.mustard, letterSpacing: 3 } });
    this.addChild(
      this.buildFace(),
      this.buildFlowers(),
      this.buildOutHole(),
      this.buildRails(),
      this.buildDisplay(),
      this.catchers,
      this.buildPins(),
      this.ballLayer,
      this.popupLayer,
      this.buildGlass(),
    );
  }

  /** The centre display: three reel windows, a status line and lamps for spins waiting. */
  private buildDisplay(): Container {
    const d = this.board.display;
    const c = new Container();
    c.position.set(d.x, d.y);
    const w = d.halfWidth;
    const h = d.halfHeight;
    c.addChild(
      new Graphics()
        .roundRect(-w + 2, -h + 5, w * 2, h * 2, 12)
        .fill({ color: 0x000000, alpha: 0.25 })
        .roundRect(-w, -h, w * 2, h * 2, 12)
        .fill(chrome())
        .roundRect(-w + 5, -h + 5, w * 2 - 10, h * 2 - 10, 8)
        .fill(COLORS.tealDeep),
      this.screenGlow,
    );
    const reels = new Graphics();
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 58;
      reels.roundRect(x - 26, -30, 52, 72, 6).fill(COLORS.brass).roundRect(x - 23, -27, 46, 66, 4).fill(COLORS.ledWindow);
      const t = new Text({ text: '7', style: { fontFamily: FONT_STACK, fontSize: 58, fontWeight: '800', fill: COLORS.ledOn } });
      t.anchor.set(0.5);
      t.position.set(x, 6);
      this.reelTexts.push(t);
    }
    this.status.anchor.set(0.5);
    this.status.position.set(0, -h + 20);
    this.spinLamps.position.set(0, h - 12);
    c.addChild(reels, ...this.reelTexts, this.status, this.spinLamps);
    return c;
  }

  private drawCatchers(machine: Machine): void {
    const g = this.catchers.clear();
    const trace = (pocket: Pocket, open: boolean): void => {
      pocketOutline(pocket, open).forEach((p, i) => (i === 0 ? g.moveTo(pocket.x + p.x, pocket.y + p.y) : g.lineTo(pocket.x + p.x, pocket.y + p.y)));
    };
    for (const pocket of this.board.pockets) {
      const { x, y, halfWidth: hw } = pocket;
      const open = machine.isOpen(pocket.id);
      if (pocket.kind === 'attacker') {
        const active = machine.jackpotRound?.open ?? false;
        g.roundRect(x - hw - 8, y - 16, (hw + 8) * 2, 32, 10).fill(chrome());
        g.roundRect(x - hw, y - 10, hw * 2, 20, 6).fill(active ? 0x0b0907 : COLORS.neon);
        if (active) g.roundRect(x - hw, y - 10, hw * 2, 20, 6).stroke({ width: 3, color: COLORS.mustard });
        else g.roundRect(x - hw + 6, y - 6, hw * 2 - 12, 5, 2).fill({ color: 0xffffff, alpha: 0.35 });
        continue;
      }
      // Dark inside, then the walls.
      const pts = pocketOutline(pocket, open).flatMap((p) => [x + p.x, y + p.y]);
      g.poly(pts).fill(0x1d1510);
      if (pocket.kind === 'tulip') {
        trace(pocket, open);
        g.stroke({ width: 9, color: 0xa8402f, cap: 'round', join: 'round' });
        trace(pocket, open);
        g.stroke({ width: 6, color: open ? COLORS.neon : COLORS.coral, cap: 'round', join: 'round' });
        g.circle(x, y + 22, 6).fill(COLORS.mustard).circle(x, y + 22, 6).stroke({ width: 1.5, color: COLORS.brassDark });
      } else {
        trace(pocket, open);
        g.stroke({ width: 8, color: 0x4a5258, cap: 'round', join: 'round' });
        trace(pocket, open);
        g.stroke({ width: 5, color: pocket.kind === 'start' ? COLORS.mustard : 0xdfe4e8, cap: 'round', join: 'round' });
      }
    }
  }

  /** A little "+5" that floats up from a catcher when it pays. */
  popup(pocket: Pocket, balls: number): void {
    const text = new Text({
      text: `+${balls}`,
      style: { fontFamily: FONT_STACK, fontSize: 26, fontWeight: '800', fill: COLORS.neon, stroke: { color: 0xfff6e0, width: 4, join: 'round' } },
    });
    text.anchor.set(0.5);
    text.position.set(pocket.x, pocket.y - 16);
    this.popupLayer.addChild(text);
    this.popups.push({ text, age: 0 });
  }

  /** Bring the display, catchers and pop-ups up to date with the machine. */
  update(dt: number, machine: Machine): void {
    this.clock += dt;
    const blink = Math.floor(this.clock * 6) % 2 === 0;
    const jackpot = machine.jackpotRound;

    const key = this.board.pockets.map((p) => (machine.isOpen(p.id) ? 1 : 0)).join('') + (jackpot?.open ? 'A' : '');
    if (key !== this.catcherKey) {
      this.catcherKey = key;
      this.drawCatchers(machine);
    }

    const stopped = machine.reelsStopped;
    this.reelTexts.forEach((t, i) => {
      const symbol = i < stopped ? machine.reels[i]! : (Math.floor(this.clock * 16 + i * 3) % 7) + 1;
      const text = String(symbol);
      if (t.text !== text) t.text = text;
      t.alpha = i < stopped ? 1 : 0.7;
    });

    let status = '';
    if (jackpot) status = jackpot.open ? `JACKPOT  ${jackpot.round} / ${jackpot.rounds}` : 'JACKPOT';
    else if (machine.inReach) status = blink ? 'REACH !' : '';
    else if (machine.bonusFlash > 0) status = blink ? 'BONUS' : '';
    if (this.status.text !== status) this.status.text = status;

    const d = this.board.display;
    this.screenGlow.clear();
    if ((jackpot || machine.inReach) && blink) {
      this.screenGlow.roundRect(-d.halfWidth + 5, -d.halfHeight + 5, d.halfWidth * 2 - 10, d.halfHeight * 2 - 10, 8).stroke({ width: 4, color: jackpot ? COLORS.mustard : COLORS.neon });
    }

    const lampKey = String(machine.heldSpins);
    if (lampKey !== this.lampKey) {
      this.lampKey = lampKey;
      this.spinLamps.clear();
      for (let i = 0; i < 4; i++) {
        this.spinLamps.circle((i - 1.5) * 18, 0, 5).fill(i < machine.heldSpins ? COLORS.mustard : 0x123f42);
      }
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i]!;
      p.age += dt;
      p.text.y -= dt * 46;
      p.text.alpha = Math.max(0, 1 - p.age / 0.9);
      if (p.age > 0.9) {
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
