import { Container, FillGradient, Graphics, Rectangle, Text } from 'pixi.js';
import { DESIGN_H, DESIGN_W } from '../layout';
import type { LauncherLogic } from '../launcher';
import type { Settings } from '../settings';
import type { GameState } from '../state';
import { COLORS, FONT_STACK } from '../theme';
import { chrome, seeded } from './draw';
import { LauncherView } from './launcherView';
import { LedCounter } from './ledCounter';
import { SettingsPanel } from './settingsPanel';

/** Where things sit in the 900 x 1600 design space. */
export const PLAYFIELD = { cx: 450, cy: 624, radius: 400 } as const;
const HEADER = { x: 60, y: 44, w: 780, h: 120 } as const;
const FIELD_PANEL = { x: 30, y: 184, w: 840, h: 880 } as const;
const CONTROL_PANEL = { x: 30, y: 1084, w: 840, h: 486 } as const;
const LAUNCHER = { x: 596, y: 1352 } as const;
const BONUS_LIGHTS = 9;

/** A wood slab with wavy grain lines, clipped to a rounded rectangle. */
function woodSlab(x: number, y: number, w: number, h: number, r: number, base: number, grainAlongX: boolean, seed: number): Container {
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
    grain.stroke({ width: 1 + rand() * 2, color: dark ? 0x4a2c0c : 0xf3d9a0, alpha: 0.1 + rand() * 0.16 });
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

/** A chunky chrome-rimmed push button for the control panel. */
class PushButton extends Container {
  constructor(text: string, onPress: () => void) {
    super();
    const face = new Graphics()
      .roundRect(0, 4, 240, 62, 31)
      .fill({ color: 0x000000, alpha: 0.35 })
      .roundRect(0, 0, 240, 62, 31)
      .fill(chrome())
      .roundRect(5, 5, 230, 52, 26)
      .fill(COLORS.cream);
    const caption = new Text({
      text,
      style: { fontFamily: FONT_STACK, fontSize: 24, fontWeight: '700', fill: COLORS.ink, letterSpacing: 5 },
    });
    caption.anchor.set(0.5);
    caption.position.set(122, 31);
    this.addChild(face, caption);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(-10, -10, 260, 82);
    this.on('pointertap', onPress);
  }
}

/** The whole machine, drawn in design units. Scale and position it with `fitCabinet`. */
export class Cabinet extends Container {
  readonly ballsRemaining = new LedCounter('BALLS REMAINING');
  readonly ballsAwarded = new LedCounter('BALLS AWARDED');
  /** Holds the board; its origin is the centre of the round playfield. */
  readonly boardLayer = new Container();
  readonly launcher: LauncherView;
  readonly settingsButton: PushButton;
  readonly settingsPanel: SettingsPanel;

  constructor(logic: LauncherLogic, settings: Settings, onSettingsChange: (settings: Settings) => void) {
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

    this.addChild(buildHeader());

    // Enamel panel that frames the round playfield.
    this.addChild(
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
              { offset: 0, color: COLORS.surround },
              { offset: 1, color: 0xdccb98 },
            ],
            textureSpace: 'local',
          }),
        ),
    );
    this.boardLayer.position.set(PLAYFIELD.cx, PLAYFIELD.cy);
    this.addChild(this.boardLayer);

    // Control panel.
    const p = CONTROL_PANEL;
    this.addChild(
      new Graphics().roundRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8, 34).fill(chrome()),
      woodSlab(p.x, p.y, p.w, p.h, 30, COLORS.woodPanel, true, 23),
      new Graphics().roundRect(p.x, p.y, p.w, p.h, 30).stroke({ width: 3, color: 0x000000, alpha: 0.35 }),
    );

    this.ballsRemaining.position.set(p.x + 44, p.y + 30);
    this.ballsAwarded.position.set(p.x + 44, p.y + 190);
    this.addChild(this.ballsRemaining, this.ballsAwarded);

    this.settingsPanel = new SettingsPanel(settings, onSettingsChange, () => undefined);
    this.settingsButton = new PushButton('SETTINGS', () => this.settingsPanel.open());
    this.settingsButton.position.set(p.x + 44, p.y + 380);
    this.addChild(this.settingsButton);

    // The whole right-hand side of the panel grabs the handle, so thumbs can't miss.
    this.launcher = new LauncherView(logic, new Rectangle(440 - LAUNCHER.x, p.y - LAUNCHER.y, p.x + p.w - 440, p.h));
    this.launcher.position.set(LAUNCHER.x, LAUNCHER.y);
    this.addChild(this.launcher);

    const inset = 34;
    const corners: [number, number][] = [
      [inset, inset],
      [DESIGN_W - inset, inset],
      [inset, DESIGN_H - inset],
      [DESIGN_W - inset, DESIGN_H - inset],
    ];
    corners.forEach(([x, y], i) => this.addChild(screw(x, y, 0.5 + i * 1.1)));

    // Last, so it opens on top of everything.
    this.addChild(this.settingsPanel);
  }

  /** Push the latest numbers to the LED counters. */
  show(state: GameState): void {
    this.ballsRemaining.value = state.ballsRemaining;
    this.ballsAwarded.value = state.ballsAwarded;
  }
}
