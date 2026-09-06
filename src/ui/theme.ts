import Phaser from 'phaser';

import { getRenderScale } from '../config/renderScale';

/**
 * Palette, type scale and the resolution every Text object is rasterised at.
 *
 * Scenes never write a hex code or a font stack of their own. These are
 * presentation values only; gameplay numbers live in `config/balance.ts`.
 */

export const FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** CSS strings, because Phaser Text styles take strings. */
export const TEXT = {
  primary: '#f5f5f5',
  secondary: '#a3a3a3',
  muted: '#525252',
  /** Score, positive feedback, active states. */
  accent: '#22c55e',
  /** The secondary accent. Golden turtle, special rewards, urgency. */
  amber: '#f59e0b',
  /** For text sitting on top of a filled accent surface. */
  onAccent: '#050505',
} as const;

/** Fill colours, as integers, because shapes and strokes take numbers. */
export const FILL = {
  /** The canvas ground. A shade above the pure black of the page. */
  background: 0x0a0a0a,
  /** Raised surfaces: the HUD band, secondary buttons. */
  surface: 0x141414,
  /** A secondary surface under the pointer. */
  surfaceHover: 0x1f1f1f,
  /** Hairline separators and outlines. Never a full-contrast border. */
  border: 0x2a2a2a,
  accent: 0x22c55e,
  /** Interaction state for the accent: darker, not lighter. */
  accentPressed: 0x16a34a,
  amber: 0xf59e0b,
  amberPressed: 0xd97706,
  /** Full black, for the pause overlay scrim. */
  scrim: 0x000000,
} as const;

/** Shared button geometry. Sharp rectangles; no decorative rounding. */
export const BUTTON = {
  width: 240,
  height: 56,
  fontSize: 18,
  /** Comfortably above the 44px minimum touch target at logical scale. */
  borderWidth: 2,
  letterSpacing: 2,
} as const;

/** Re-exported so `ui/theme` is the only presentational import a scene needs. */
export { getRenderScale } from '../config/renderScale';

export interface TextOptions {
  readonly fontSize: number;
  readonly color: string;
  /** CSS font weight. 700 for values and headlines, 600 for supporting copy. */
  readonly weight?: string;
  /** Applied via `setLetterSpacing`; Phaser 4 keeps it off the style config. */
  readonly letterSpacing?: number;
  readonly align?: string;
}

/**
 * The only place a Phaser Text object is created, so `resolution` cannot be
 * missed on one.
 *
 * It must be the render scale, not the device pixel ratio: the scene camera is
 * zoomed by that scale, so a glyph of logical size S covers `S * scale` device
 * pixels and rasterising at exactly that gives a 1:1 mapping. Phaser 4 has no
 * game-config `resolution` key, and `TextStyle.resolution` defaults to 0 which
 * the constructor forces to 1, so per-object is the only option.
 */
export function createText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  options: TextOptions,
): Phaser.GameObjects.Text {
  const text = scene.add.text(x, y, content, {
    fontFamily: FONT_STACK,
    fontSize: `${String(options.fontSize)}px`,
    fontStyle: options.weight ?? '700',
    color: options.color,
    align: options.align ?? 'left',
    resolution: getRenderScale(),
  });

  if (options.letterSpacing !== undefined) {
    text.setLetterSpacing(options.letterSpacing);
  }

  return text;
}
