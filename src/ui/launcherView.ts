import { Container, Graphics, Rectangle, Text, type FederatedPointerEvent } from 'pixi.js';
import type { LauncherLogic } from '../launcher';
import { COLORS, FONT_STACK } from '../theme';
import { chrome } from './draw';

/** Design units of downward drag for a full pull. */
export const FULL_PULL_DRAG = 190;
/** How far the handle swings at full pull, in radians. */
const SWING = 0.92;
const ARM_END = { x: 150, y: -132 };

/**
 * The chrome launch handle. Touch or click anywhere around it and drag down to pull it
 * back; it follows the finger and springs forward on release, shooting one ball.
 */
export class LauncherView extends Container {
  private readonly arm = new Container();
  private grabY = 0;
  private pointerId: number | null = null;
  private shown = 0;
  private kick = 0;

  /** Called when the player lets go of the handle, with the shot's power if one fires. */
  onRelease: (power: number | null) => void = () => undefined;
  /** Called on any touch, for unlocking sound. */
  onTouch: () => void = () => undefined;

  constructor(
    private readonly logic: LauncherLogic,
    readonly grabArea: Rectangle,
  ) {
    super();

    // Base plate and hub.
    this.addChild(
      new Graphics()
        .roundRect(-118, -92, 330, 250, 60)
        .fill({ color: 0x000000, alpha: 0.3 })
        .roundRect(-122, -98, 330, 250, 60)
        .fill(chrome(false))
        .roundRect(-112, -88, 310, 230, 52)
        .fill(COLORS.turquoise)
        .roundRect(-112, -88, 310, 230, 52)
        .stroke({ width: 2, color: 0x2f6f76, alpha: 0.8 }),
    );

    // Power scale: the knob sweeps along these ticks.
    const ticks = new Graphics();
    const rest = Math.atan2(ARM_END.y, ARM_END.x);
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const a = rest + (SWING * i) / n;
      const major = i % 5 === 0;
      const r0 = major ? 226 : 232;
      const r1 = 244;
      ticks
        .moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
        .lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
        .stroke({ width: major ? 4 : 2, color: i >= 16 ? COLORS.neon : COLORS.cream, cap: 'round' });
    }
    this.addChild(ticks);

    this.addChild(
      new Graphics()
        .circle(0, 4, 76)
        .fill({ color: 0x000000, alpha: 0.3 })
        .circle(0, 0, 74)
        .fill(chrome(false))
        .circle(0, 0, 60)
        .fill(0x3b4247)
        .circle(0, 0, 56)
        .fill(chrome()),
    );

    // The arm: a curved chrome bar with a ball knob.
    const bar = new Graphics();
    const path = (): Graphics => bar.moveTo(0, 0).bezierCurveTo(56, -6, 62, -112, ARM_END.x, ARM_END.y);
    path().stroke({ width: 30, color: 0x2e3438, cap: 'round' });
    path().stroke({ width: 25, color: 0x9aa3aa, cap: 'round' });
    path().stroke({ width: 14, color: 0xe4e8eb, cap: 'round' });
    path().stroke({ width: 4, color: 0xffffff, cap: 'round' });
    bar
      .circle(ARM_END.x, ARM_END.y, 27)
      .fill(0x2e3438)
      .circle(ARM_END.x, ARM_END.y, 25)
      .fill(COLORS.neon)
      .circle(ARM_END.x - 8, ARM_END.y - 9, 8)
      .fill({ color: 0xffffff, alpha: 0.5 })
      .circle(0, 0, 36)
      .fill(chrome(false))
      .circle(0, 0, 36)
      .stroke({ width: 2, color: 0x30363a, alpha: 0.8 })
      .circle(0, 0, 13)
      .fill(COLORS.ink);
    this.arm.addChild(bar);
    this.addChild(this.arm);

    const label = new Text({
      text: 'PULL  ▼',
      style: { fontFamily: FONT_STACK, fontSize: 22, fontWeight: '700', fill: 0x1f5b61, letterSpacing: 4 },
    });
    label.anchor.set(0.5);
    label.position.set(-28, 112);
    this.addChild(label);

    this.eventMode = 'static';
    this.cursor = 'grab';
    this.hitArea = grabArea;
    this.on('pointerdown', this.down, this);
    this.on('globalpointermove', this.move, this);
    this.on('pointerup', this.up, this);
    this.on('pointerupoutside', this.up, this);
    this.on('pointercancel', this.up, this);
  }

  private down(e: FederatedPointerEvent): void {
    this.onTouch();
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.grabY = this.toLocal(e.global).y;
    this.cursor = 'grabbing';
    this.logic.grab();
  }

  private move(e: FederatedPointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.logic.setPull((this.toLocal(e.global).y - this.grabY) / FULL_PULL_DRAG);
  }

  private up(e: FederatedPointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.cursor = 'grab';
    this.onRelease(this.logic.release());
  }

  /** Drop the handle without shooting. */
  cancel(): void {
    this.pointerId = null;
    this.cursor = 'grab';
    this.logic.cancel();
  }

  /** The handle snaps forward as a ball leaves. */
  fired(): void {
    this.kick = 1;
  }

  /** Animate towards the current pull. */
  update(dt: number): void {
    const target = this.logic.pull;
    // Follow the finger closely, spring back quickly on release.
    const rate = target < this.shown ? 26 : 40;
    this.shown += (target - this.shown) * Math.min(1, dt * rate);
    this.kick = Math.max(0, this.kick - dt * 9);
    const snap = this.kick * Math.min(this.shown, 0.35) * 0.9;
    this.arm.rotation = (this.shown - snap) * SWING;
  }
}
