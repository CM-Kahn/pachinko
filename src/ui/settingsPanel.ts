import { Container, Graphics, Rectangle, Text, type FederatedPointerEvent } from 'pixi.js';
import { DESIGN_H, DESIGN_W } from '../layout';
import { PAYOUTS, snapLuck, type Settings } from '../settings';
import { COLORS, FONT_STACK } from '../theme';
import { chrome } from './draw';

const CARD = { x: 90, y: 260, w: 720, h: 740 } as const;
/** The luck slider's track, in cabinet design units. */
export const LUCK_TRACK = { x0: CARD.x + 100, x1: CARD.x + CARD.w - 100, y: CARD.y + 370 } as const;
export const SOUND_SWITCH = { x: CARD.x + CARD.w - 250, y: CARD.y + 128, w: 170, h: 72 } as const;
export const DONE_BUTTON = { x: CARD.x + CARD.w / 2 - 130, y: CARD.y + 626, w: 260, h: 72 } as const;
/** One button per payout choice, left to right. */
export const PAYOUT_BUTTONS = PAYOUTS.map((value, i) => ({ value, x: CARD.x + 300 + i * 120, y: CARD.y + 506, w: 104, h: 72 }));

function label(text: string, size: number, color: number = COLORS.ink, spacing = 4): Text {
  return new Text({ text, style: { fontFamily: FONT_STACK, fontSize: size, fontWeight: '700', fill: color, letterSpacing: spacing } });
}

/** A small panel that opens on top of the machine: sound switch and the luck slider. */
export class SettingsPanel extends Container {
  private readonly switchFace = new Graphics();
  private readonly switchText = label('', 26);
  private readonly knob = new Graphics();
  private readonly fill = new Graphics();
  private readonly payoutFaces = new Graphics();
  private readonly payoutTexts: Text[] = [];
  private dragging: number | null = null;

  constructor(
    private readonly settings: Settings,
    private readonly onChange: (settings: Settings) => void,
    private readonly onClose: () => void,
  ) {
    super();
    this.visible = false;

    // Dim the machine and swallow touches so the handle can't fire behind the panel.
    const shade = new Graphics().roundRect(0, 0, DESIGN_W, DESIGN_H, 48).fill({ color: 0x000000, alpha: 0.55 });
    shade.eventMode = 'static';
    shade.on('pointertap', () => this.close());
    this.addChild(shade);

    const card = new Graphics()
      .roundRect(CARD.x + 6, CARD.y + 12, CARD.w, CARD.h, 40)
      .fill({ color: 0x000000, alpha: 0.4 })
      .roundRect(CARD.x - 6, CARD.y - 6, CARD.w + 12, CARD.h + 12, 44)
      .fill(chrome())
      .roundRect(CARD.x, CARD.y, CARD.w, CARD.h, 38)
      .fill(COLORS.cream)
      .roundRect(CARD.x, CARD.y, CARD.w, 86, 38)
      .fill(COLORS.tealDeep)
      .rect(CARD.x, CARD.y + 48, CARD.w, 38)
      .fill(COLORS.tealDeep);
    card.eventMode = 'static';
    this.addChild(card);

    const title = label('SETTINGS', 38, COLORS.cream, 10);
    title.anchor.set(0.5);
    title.position.set(DESIGN_W / 2 + 5, CARD.y + 44);
    this.addChild(title);

    // Sound.
    const sound = label('SOUND', 32);
    sound.anchor.set(0, 0.5);
    sound.position.set(CARD.x + 80, SOUND_SWITCH.y + SOUND_SWITCH.h / 2);
    this.switchText.anchor.set(0.5);
    this.switchFace.eventMode = 'static';
    this.switchFace.cursor = 'pointer';
    this.switchFace.hitArea = new Rectangle(SOUND_SWITCH.x - 12, SOUND_SWITCH.y - 12, SOUND_SWITCH.w + 24, SOUND_SWITCH.h + 24);
    this.switchFace.on('pointertap', () => {
      this.settings.soundOn = !this.settings.soundOn;
      this.changed();
    });
    this.addChild(sound, this.switchFace, this.switchText);

    // Luck.
    const luck = label('LUCK', 32);
    luck.position.set(CARD.x + 80, CARD.y + 262);
    this.addChild(luck);

    const { x0, x1, y } = LUCK_TRACK;
    const mid = (x0 + x1) / 2;
    const track = new Graphics()
      .roundRect(x0 - 10, y - 10, x1 - x0 + 20, 20, 10)
      .fill(0x3b332b)
      .roundRect(x0 - 7, y - 7, x1 - x0 + 14, 14, 7)
      .fill(0x6c6152);
    for (let i = 0; i <= 10; i++) {
      const x = x0 + ((x1 - x0) * i) / 10;
      const tall = i === 5;
      track.moveTo(x, y + 22).lineTo(x, y + (tall ? 44 : 34)).stroke({ width: tall ? 4 : 2, color: tall ? COLORS.tealDeep : 0x8a7d66, cap: 'round' });
    }
    track.eventMode = 'static';
    track.cursor = 'pointer';
    track.hitArea = new Rectangle(x0 - 60, y - 60, x1 - x0 + 120, 120);
    track.on('pointerdown', (e: FederatedPointerEvent) => {
      this.dragging = e.pointerId;
      this.drag(e, false);
    });
    track.on('globalpointermove', (e: FederatedPointerEvent) => {
      if (e.pointerId === this.dragging) this.drag(e, false);
    });
    const end = (e: FederatedPointerEvent): void => {
      if (e.pointerId !== this.dragging) return;
      this.dragging = null;
      this.drag(e, true);
    };
    track.on('pointerup', end);
    track.on('pointerupoutside', end);
    track.on('pointercancel', end);
    this.addChild(track, this.fill, this.knob);

    const captions: [string, number, number][] = [
      ['HARDER', x0, 0],
      ['NORMAL', mid, 0.5],
      ['EASIER', x1, 1],
    ];
    for (const [text, x, anchor] of captions) {
      const t = label(text, 22, 0x5c5244, 3);
      t.anchor.set(anchor, 0);
      t.position.set(x, y + 52);
      this.addChild(t);
    }

    // Payout: how many balls each caught ball pays.
    const payout = label('PAYOUT', 32);
    payout.anchor.set(0, 0.5);
    payout.position.set(CARD.x + 80, PAYOUT_BUTTONS[0]!.y + 36);
    const perBall = label('BALLS FOR EVERY BALL IN A POCKET', 20, 0x5c5244, 2);
    perBall.anchor.set(1, 0);
    perBall.position.set(CARD.x + CARD.w - 76, PAYOUT_BUTTONS[0]!.y + 82);
    this.addChild(payout, perBall, this.payoutFaces);
    for (const b of PAYOUT_BUTTONS) {
      const hit = new Graphics().rect(b.x - 8, b.y - 8, b.w + 16, b.h + 16).fill({ color: 0xffffff, alpha: 0 });
      hit.eventMode = 'static';
      hit.cursor = 'pointer';
      hit.on('pointertap', () => {
        this.settings.payout = b.value;
        this.changed();
      });
      const t = label(String(b.value), 32, COLORS.ink, 2);
      t.anchor.set(0.5);
      t.position.set(b.x + b.w / 2, b.y + b.h / 2);
      this.payoutTexts.push(t);
      this.addChild(hit, t);
    }

    // Done.
    const b = DONE_BUTTON;
    const done = new Graphics()
      .roundRect(b.x, b.y + 5, b.w, b.h, b.h / 2)
      .fill({ color: 0x000000, alpha: 0.3 })
      .roundRect(b.x, b.y, b.w, b.h, b.h / 2)
      .fill(chrome())
      .roundRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12, b.h / 2 - 6)
      .fill(COLORS.tealDeep);
    done.eventMode = 'static';
    done.cursor = 'pointer';
    done.on('pointertap', () => this.close());
    const doneText = label('DONE', 30, COLORS.cream, 8);
    doneText.anchor.set(0.5);
    doneText.position.set(b.x + b.w / 2 + 4, b.y + b.h / 2);
    this.addChild(done, doneText);

    this.redraw();
  }

  get isOpen(): boolean {
    return this.visible;
  }

  open(): void {
    this.redraw();
    this.visible = true;
  }

  close(): void {
    if (!this.visible) return;
    this.visible = false;
    this.dragging = null;
    this.onClose();
  }

  private drag(e: FederatedPointerEvent, settle: boolean): void {
    const { x0, x1 } = LUCK_TRACK;
    const x = this.toLocal(e.global).x;
    const raw = Math.min(1, Math.max(-1, ((x - x0) / (x1 - x0)) * 2 - 1));
    // The knob follows the finger; on release it settles on Normal if it is close.
    this.settings.luck = settle ? snapLuck(raw) : raw;
    this.changed();
  }

  private changed(): void {
    this.redraw();
    this.onChange(this.settings);
  }

  private redraw(): void {
    const s = SOUND_SWITCH;
    const on = this.settings.soundOn;
    this.switchFace
      .clear()
      .roundRect(s.x - 4, s.y - 4, s.w + 8, s.h + 8, s.h / 2 + 4)
      .fill(chrome())
      .roundRect(s.x, s.y, s.w, s.h, s.h / 2)
      .fill(on ? COLORS.teal : 0x8a7d66)
      .circle(on ? s.x + s.w - s.h / 2 : s.x + s.h / 2, s.y + s.h / 2, s.h / 2 - 6)
      .fill(COLORS.cream)
      .circle(on ? s.x + s.w - s.h / 2 : s.x + s.h / 2, s.y + s.h / 2, s.h / 2 - 6)
      .stroke({ width: 2, color: 0x3b332b, alpha: 0.5 });
    this.switchText.text = on ? 'ON' : 'OFF';
    this.switchText.style.fill = COLORS.cream;
    this.switchText.position.set(on ? s.x + (s.w - s.h) / 2 + 12 : s.x + s.h + (s.w - s.h) / 2 - 12, s.y + s.h / 2);

    this.payoutFaces.clear();
    PAYOUT_BUTTONS.forEach((b, i) => {
      const chosen = b.value === this.settings.payout;
      this.payoutFaces
        .roundRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8, b.h / 2 + 4)
        .fill(chrome())
        .roundRect(b.x, b.y, b.w, b.h, b.h / 2)
        .fill(chosen ? COLORS.teal : COLORS.cream);
      this.payoutTexts[i]!.style.fill = chosen ? COLORS.cream : COLORS.ink;
    });

    const { x0, x1, y } = LUCK_TRACK;
    const mid = (x0 + x1) / 2;
    const x = mid + (this.settings.luck * (x1 - x0)) / 2;
    this.fill.clear();
    if (Math.abs(x - mid) > 1) {
      this.fill.roundRect(Math.min(x, mid), y - 7, Math.abs(x - mid), 14, 7).fill(this.settings.luck > 0 ? COLORS.teal : COLORS.neon);
    }
    this.knob
      .clear()
      .circle(x, y + 4, 31)
      .fill({ color: 0x000000, alpha: 0.3 })
      .circle(x, y, 30)
      .fill(chrome(false))
      .circle(x, y, 30)
      .stroke({ width: 2, color: 0x30363a, alpha: 0.8 })
      .circle(x, y, 13)
      .fill(COLORS.neon);
  }
}
