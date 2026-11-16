/** Showa-era retro arcade palette: cream and teal enamel, chrome, warm wood, neon accents. */
export const COLORS = {
  room: 0x14100d,
  wood: 0x7b4a27,
  woodDark: 0x54301a,
  woodPanel: 0x633a1f,
  cream: 0xf2e6c8,
  creamShade: 0xd9caa4,
  teal: 0x2e8c8a,
  tealDeep: 0x1c5f63,
  neon: 0xff6b5a,
  brass: 0xc9a253,
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
