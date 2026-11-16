/** The cabinet is drawn in a fixed portrait design space and scaled to fit any screen. */
export const DESIGN_W = 900;
export const DESIGN_H = 1600;

export interface Fit {
  /** Uniform scale from design units to CSS pixels. */
  scale: number;
  /** Top-left of the cabinet in CSS pixels. */
  x: number;
  y: number;
}

/** Largest uniform scale that shows the whole cabinet, centred, with an optional margin. */
export function fitCabinet(viewW: number, viewH: number, margin = 0): Fit {
  const availW = Math.max(1, viewW - margin * 2);
  const availH = Math.max(1, viewH - margin * 2);
  const scale = Math.min(availW / DESIGN_W, availH / DESIGN_H);
  return {
    scale,
    x: (viewW - DESIGN_W * scale) / 2,
    y: (viewH - DESIGN_H * scale) / 2,
  };
}
