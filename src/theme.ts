/**
 * Showa-era retro arcade palette, after the look of 1970s machines: honey wood cabinet,
 * chrome frame, cream playfield with faded mid-century flowers, turquoise and coral accents.
 */
export const COLORS = {
  room: 0x14100d,
  wood: 0xc9a155,
  woodDark: 0x8d6c30,
  woodPanel: 0x5f3a1f,
  cream: 0xf5ecd2,
  creamShade: 0xe6d8ae,
  surround: 0xecdfb8,
  teal: 0x2e8c8a,
  tealDeep: 0x1c5f63,
  turquoise: 0x6fc4cc,
  neon: 0xff6b5a,
  brass: 0xc9a253,
  brassDark: 0x7d5f22,
  sage: 0x9db58a,
  mustard: 0xe3b94f,
  coral: 0xf08a6e,
  sky: 0x8fc7d6,
  ledOn: 0xff2a14,
  ledGhost: 0x3a0a06,
  ledWindow: 0x120403,
  ink: 0x1a1512,
} as const;

/** Chrome reads as bright-dark-bright bands; used top-to-bottom on trim. */
export const CHROME_STOPS = [
  { offset: 0, color: 0xfdfdfd },
  { offset: 0.35, color: 0xb9c0c6 },
  { offset: 0.5, color: 0x5d666e },
  { offset: 0.62, color: 0xd5dade },
  { offset: 1, color: 0x8a9299 },
];

export const FONT_STACK = '"Avenir Next Condensed", "Futura", "Trebuchet MS", "Helvetica Neue", Arial, sans-serif';
