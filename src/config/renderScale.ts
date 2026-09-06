import { GAME_HEIGHT, GAME_WIDTH } from './dimensions';

/**
 * How many device pixels the game renders per logical pixel.
 *
 * One number drives the canvas size, the scene camera zoom, every Text object's
 * rasterisation resolution and the generated turtle texture density. They must
 * agree, or something is rasterised for a framebuffer it does not land in.
 */

/** Raising this grows the framebuffer and every text/turtle texture quadratically. */
export const MAX_RENDER_SCALE = 2;

export interface DisplayMetrics {
  readonly devicePixelRatio: number;
  /** Viewport size in CSS pixels. */
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

function usable(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Choose the render scale for a set of display metrics.
 *
 * `ceil(devicePixelRatio)` alone is not enough: `Scale.FIT` stretches the
 * playfield to fill the viewport, and that stretch multiplies the ratio. A
 * 1536x864 window on a ratio-1 display resolves the frame at 1.6 device pixels
 * per logical pixel, so the ratio alone would pick 1 and leave it upscaled.
 *
 * Rounded up, so the browser downsamples rather than upsamples. The result is a
 * whole number: that keeps logical pixel boundaries on device pixel boundaries,
 * keeps the turtle texture's dimensions exact, and is required by Phaser's
 * `renderRoundPixels`, which checks `Number.isInteger(zoomX)`.
 */
export function renderScaleFor(metrics: DisplayMetrics): number {
  const ratio = usable(metrics.devicePixelRatio, 1);
  const viewportWidth = usable(metrics.viewportWidth, GAME_WIDTH);
  const viewportHeight = usable(metrics.viewportHeight, GAME_HEIGHT);

  // FIT letterboxes the larger axis, so the smaller ratio is the one on screen.
  const fitScale = Math.min(viewportWidth / GAME_WIDTH, viewportHeight / GAME_HEIGHT);

  return Math.min(Math.max(Math.ceil(ratio * fitScale), 1), MAX_RENDER_SCALE);
}

/** Falls back to a notional 1:1 display when there is no `window` (Node, tests). */
export function readDisplayMetrics(): DisplayMetrics {
  if (typeof window === 'undefined') {
    return { devicePixelRatio: 1, viewportWidth: GAME_WIDTH, viewportHeight: GAME_HEIGHT };
  }

  return {
    devicePixelRatio: window.devicePixelRatio,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };
}

let memoisedScale: number | null = null;

/**
 * The render scale for this session.
 *
 * Memoised for correctness, not speed: the canvas is sized once at boot, so a
 * later caller re-reading a resized viewport would rasterise for a framebuffer
 * that does not exist. The trade is that a resize does not re-derive the scale
 * until reload, which beats re-creating every texture on every resize event.
 */
export function getRenderScale(): number {
  memoisedScale ??= renderScaleFor(readDisplayMetrics());

  return memoisedScale;
}
