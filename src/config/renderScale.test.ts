import { describe, expect, it } from 'vitest';

import { GAME_HEIGHT, GAME_WIDTH } from './dimensions';
import {
  getRenderScale,
  MAX_RENDER_SCALE,
  readDisplayMetrics,
  renderScaleFor,
  type DisplayMetrics,
} from './renderScale';

/**
 * These run under Node, where `window` does not exist. That is the point: the
 * scale decision is ordinary arithmetic and belongs somewhere testable, and the
 * suite would fail at import time if this module ever reached for Phaser or the
 * DOM outside the guard in `readDisplayMetrics`.
 */

function metrics(
  devicePixelRatio: number,
  viewportWidth: number,
  viewportHeight: number,
): DisplayMetrics {
  return { devicePixelRatio, viewportWidth, viewportHeight };
}

describe('renderScaleFor', () => {
  it('renders 1:1 when the playfield is displayed at exactly its logical size', () => {
    expect(renderScaleFor(metrics(1, GAME_WIDTH, GAME_HEIGHT))).toBe(1);
  });

  it('accounts for the stretch Scale.FIT applies, not just the pixel ratio', () => {
    // A 1536x864 window on a ratio-1 display stretches 960x540 by 1.6. Deciding
    // on the ratio alone would pick 1 here and leave the frame upscaled, which
    // is the exact bug this function exists to avoid.
    expect(renderScaleFor(metrics(1, 1536, 864))).toBe(2);
  });

  it('scales up on a HiDPI display', () => {
    expect(renderScaleFor(metrics(2, 1440, 810))).toBe(2);
  });

  it('takes the smaller axis, because the larger one is letterboxed', () => {
    // Very wide but short: height is the limiting axis, so the playfield is only
    // displayed at 540/540 = 1x and needs no extra density.
    expect(renderScaleFor(metrics(1, 4000, 540))).toBe(1);
  });

  it('stays at 1 for a small window on a standard display', () => {
    expect(renderScaleFor(metrics(1, 800, 450))).toBe(1);
  });

  it('stays at 1 when a phone displays the playfield smaller than it is drawn', () => {
    // 390 CSS px at ratio 2 is 780 device pixels across, which a 960-wide
    // framebuffer already covers.
    expect(renderScaleFor(metrics(2, 390, 844))).toBe(1);
  });

  it('scales up when a phone display does out-resolve the logical playfield', () => {
    expect(renderScaleFor(metrics(3, 430, 932))).toBe(2);
  });

  it('never exceeds the ceiling, however extreme the display', () => {
    expect(renderScaleFor(metrics(4, 3840, 2160))).toBe(MAX_RENDER_SCALE);
    expect(renderScaleFor(metrics(10, 8000, 5000))).toBe(MAX_RENDER_SCALE);
  });

  it('always returns a whole number, as integer camera zoom requires', () => {
    for (const ratio of [1, 1.25, 1.5, 1.75, 2, 3]) {
      for (const width of [700, 960, 1200, 1536, 1920, 2560]) {
        const scale = renderScaleFor(metrics(ratio, width, (width * 9) / 16));

        expect(Number.isInteger(scale)).toBe(true);
        expect(scale).toBeGreaterThanOrEqual(1);
        expect(scale).toBeLessThanOrEqual(MAX_RENDER_SCALE);
      }
    }
  });

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'falls back to a ratio of 1 for the unusable pixel ratio %p',
    (ratio) => {
      expect(renderScaleFor(metrics(ratio, GAME_WIDTH, GAME_HEIGHT))).toBe(1);
    },
  );

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY, -100])(
    'falls back to the logical size for the unusable viewport width %p',
    (width) => {
      expect(renderScaleFor(metrics(1, width, GAME_HEIGHT))).toBe(1);
    },
  );

  it('survives a zero-sized viewport without producing a non-finite scale', () => {
    const scale = renderScaleFor(metrics(0, 0, 0));

    expect(Number.isFinite(scale)).toBe(true);
    expect(scale).toBe(1);
  });
});

describe('readDisplayMetrics', () => {
  it('reports a 1:1 logical display when there is no window', () => {
    expect(readDisplayMetrics()).toEqual({
      devicePixelRatio: 1,
      viewportWidth: GAME_WIDTH,
      viewportHeight: GAME_HEIGHT,
    });
  });
});

describe('getRenderScale', () => {
  it('returns a usable scale under Node', () => {
    expect(getRenderScale()).toBe(1);
  });

  it('returns the same value every call, so canvas, camera and textures agree', () => {
    expect(getRenderScale()).toBe(getRenderScale());
  });
});
