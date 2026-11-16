import { Container, Graphics, Text } from 'pixi.js';
import { COLORS, FONT_STACK } from '../theme';
import { SEGMENTS, formatCounter, litSegments, segmentPolygon } from './sevenSegment';

const DIGIT_W = 46;
const DIGIT_H = 70;
const THICK = 9;
const DIGIT_GAP = 20;
const PAD_X = 26;
const PAD_Y = 12;
const LABEL_H = 36;

/** A labelled red LED read-out set into the control panel. */
export class LedCounter extends Container {
  readonly digits: number;
  private readonly lit = new Graphics();
  private shown = '';

  constructor(label: string, digits = 5) {
    super();
    this.digits = digits;

    const windowW = PAD_X * 2 + digits * DIGIT_W + (digits - 1) * DIGIT_GAP;
    const windowH = PAD_Y * 2 + DIGIT_H;

    const plate = new Text({
      text: label,
      style: { fontFamily: FONT_STACK, fontSize: 24, fontWeight: '700', fill: COLORS.cream, letterSpacing: 4 },
    });
    plate.position.set(4, 0);
    this.addChild(plate);

    const bezel = new Graphics()
      .roundRect(-5, LABEL_H - 5, windowW + 10, windowH + 10, 14)
      .fill(COLORS.brass)
      .roundRect(-2, LABEL_H - 2, windowW + 4, windowH + 4, 11)
      .fill(COLORS.ink)
      .roundRect(0, LABEL_H, windowW, windowH, 9)
      .fill(COLORS.ledWindow);
    this.addChild(bezel);

    // Segments lean slightly, like a real display module.
    const face = new Container();
    face.position.set(PAD_X + 5, LABEL_H + PAD_Y);
    face.skew.x = -0.07;
    this.addChild(face);

    const ghost = new Graphics();
    for (let i = 0; i < digits; i++) {
      this.drawDigit(ghost, i, SEGMENTS, true);
    }
    ghost.fill(COLORS.ledGhost);
    face.addChild(ghost, this.lit);

    // Smoked-glass sheen across the top half of the window.
    this.addChild(
      new Graphics().roundRect(3, LABEL_H + 3, windowW - 6, windowH * 0.42, 7).fill({ color: 0xffffff, alpha: 0.05 }),
    );

    this.value = 0;
  }

  set value(v: number) {
    const text = formatCounter(v, this.digits);
    if (text === this.shown) return;
    this.shown = text;
    this.lit.clear();
    let any = false;
    for (let i = 0; i < this.digits; i++) {
      const on = SEGMENTS.filter((s) => litSegments(text[i] ?? ' ').has(s));
      if (on.length > 0) {
        this.drawDigit(this.lit, i, on, false);
        any = true;
      }
    }
    if (any) this.lit.fill(COLORS.ledOn);
  }

  /** The characters currently displayed (useful for tests). */
  get text(): string {
    return this.shown;
  }

  private drawDigit(g: Graphics, index: number, segs: readonly (typeof SEGMENTS)[number][], withPoint: boolean): void {
    const ox = index * (DIGIT_W + DIGIT_GAP);
    for (const seg of segs) {
      const pts = segmentPolygon(seg, DIGIT_W, DIGIT_H, THICK);
      g.poly(pts.map((p, i) => (i % 2 === 0 ? p + ox : p)));
    }
    if (withPoint) g.circle(ox + DIGIT_W + DIGIT_GAP * 0.45, DIGIT_H - THICK / 2, THICK / 2);
  }
}
