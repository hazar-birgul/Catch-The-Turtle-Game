/**
 * Shared look for the temporary interface.
 *
 * Every scene draws its text and buttons from here rather than repeating a font
 * stack and a hex code, so the art phase can restyle the whole game by editing
 * one file. These are presentation values only — nothing here affects gameplay,
 * so none of it belongs in `config/balance.ts`.
 */

export const FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Text colours, as CSS strings, because Phaser Text styles take strings. */
export const TEXT = {
  primary: '#f4fff8',
  muted: '#7f9d93',
  faint: '#4b6058',
  accent: '#4ade80',
  gold: '#facc15',
  onAccent: '#0f1f1b',
} as const;

/** Fill colours, as integers, because shapes and strokes take numbers. */
export const FILL = {
  background: 0x0f1f1b,
  panel: 0x122a24,
  band: 0x0b1714,
  shell: 0x1c3a33,
  accent: 0x4ade80,
  accentHover: 0x86efac,
  gold: 0xfacc15,
} as const;
