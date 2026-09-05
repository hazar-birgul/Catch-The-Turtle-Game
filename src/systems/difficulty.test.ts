import { describe, expect, it } from 'vitest';

import { BALANCE, type DifficultyBalance } from '../config/balance';
import { difficultyAt, difficultyProgressAt } from './difficulty';

const { difficulty: CURVE } = BALANCE;
const RAMP_MS = CURVE.rampDurationMs;

describe('difficultyProgressAt', () => {
  it('is 0 at the start and 1 once the ramp completes', () => {
    expect(difficultyProgressAt(0)).toBe(0);
    expect(difficultyProgressAt(RAMP_MS)).toBe(1);
  });

  it('clamps negative elapsed time to the start of the ramp', () => {
    expect(difficultyProgressAt(-1)).toBe(0);
    expect(difficultyProgressAt(-100_000)).toBe(0);
  });

  it('clamps past-the-end elapsed time to a fully ramped round', () => {
    expect(difficultyProgressAt(RAMP_MS * 2)).toBe(1);
    expect(difficultyProgressAt(BALANCE.round.durationMs)).toBe(1);
    expect(difficultyProgressAt(Number.MAX_SAFE_INTEGER)).toBe(1);
  });

  it('survives a non-finite elapsed value without producing NaN', () => {
    expect(difficultyProgressAt(Number.NaN)).toBe(0);
    expect(difficultyProgressAt(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('stays within 0..1 across the whole round', () => {
    for (let elapsed = 0; elapsed <= BALANCE.round.durationMs; elapsed += 1000) {
      const progress = difficultyProgressAt(elapsed);

      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    }
  });

  it('back-loads the ramp, so halfway through time is less than halfway through difficulty', () => {
    // A consequence of easingExponent > 1: the opening stays approachable.
    expect(CURVE.easingExponent).toBeGreaterThan(1);
    expect(difficultyProgressAt(RAMP_MS / 2)).toBeLessThan(0.5);
  });

  it('increases monotonically', () => {
    let previous = -1;

    for (let elapsed = 0; elapsed <= RAMP_MS; elapsed += 500) {
      const progress = difficultyProgressAt(elapsed);

      expect(progress).toBeGreaterThanOrEqual(previous);
      previous = progress;
    }
  });
});

describe('difficultyAt', () => {
  it('returns the configured starting parameters at time zero', () => {
    const params = difficultyAt(0);

    expect(params.progress).toBe(0);
    expect(params.spawnIntervalMs).toBeCloseTo(CURVE.spawnIntervalMs.start, 10);
    expect(params.targetLifetimeMs).toBeCloseTo(CURVE.targetLifetimeMs.start, 10);
    expect(params.targetScale).toBeCloseTo(CURVE.targetScale.start, 10);
    expect(params.maxConcurrent).toBe(Math.max(1, Math.round(CURVE.maxConcurrent.start)));
  });

  it('returns the configured end parameters once fully ramped', () => {
    const params = difficultyAt(RAMP_MS);

    expect(params.progress).toBe(1);
    expect(params.spawnIntervalMs).toBeCloseTo(CURVE.spawnIntervalMs.end, 10);
    expect(params.targetLifetimeMs).toBeCloseTo(CURVE.targetLifetimeMs.end, 10);
    expect(params.targetScale).toBeCloseTo(CURVE.targetScale.end, 10);
    expect(params.maxConcurrent).toBe(Math.round(CURVE.maxConcurrent.end));
  });

  it('sits strictly between the endpoints at the midpoint of the round', () => {
    const params = difficultyAt(BALANCE.round.durationMs / 2);

    expect(params.spawnIntervalMs).toBeLessThan(CURVE.spawnIntervalMs.start);
    expect(params.spawnIntervalMs).toBeGreaterThan(CURVE.spawnIntervalMs.end);
    expect(params.targetLifetimeMs).toBeLessThan(CURVE.targetLifetimeMs.start);
    expect(params.targetLifetimeMs).toBeGreaterThan(CURVE.targetLifetimeMs.end);
  });

  it('holds the hardest settings for the closing seconds of the round', () => {
    // The ramp finishes before the round does, on purpose.
    expect(RAMP_MS).toBeLessThan(BALANCE.round.durationMs);

    const atRampEnd = difficultyAt(RAMP_MS);
    const atRoundEnd = difficultyAt(BALANCE.round.durationMs);

    expect(atRoundEnd).toEqual(atRampEnd);
  });

  it('clamps out-of-range elapsed values to the endpoints', () => {
    expect(difficultyAt(-5000)).toEqual(difficultyAt(0));
    expect(difficultyAt(RAMP_MS * 10)).toEqual(difficultyAt(RAMP_MS));
  });

  it('shortens the spawn interval monotonically', () => {
    let previous = Number.POSITIVE_INFINITY;

    for (let elapsed = 0; elapsed <= BALANCE.round.durationMs; elapsed += 1000) {
      const { spawnIntervalMs } = difficultyAt(elapsed);

      expect(spawnIntervalMs).toBeLessThanOrEqual(previous);
      previous = spawnIntervalMs;
    }
  });

  it('shortens the target lifetime monotonically', () => {
    let previous = Number.POSITIVE_INFINITY;

    for (let elapsed = 0; elapsed <= BALANCE.round.durationMs; elapsed += 1000) {
      const { targetLifetimeMs } = difficultyAt(elapsed);

      expect(targetLifetimeMs).toBeLessThanOrEqual(previous);
      previous = targetLifetimeMs;
    }
  });

  it('keeps every parameter inside its configured bounds all round', () => {
    for (let elapsed = 0; elapsed <= BALANCE.round.durationMs; elapsed += 500) {
      const params = difficultyAt(elapsed);

      expect(params.spawnIntervalMs).toBeLessThanOrEqual(CURVE.spawnIntervalMs.start);
      expect(params.spawnIntervalMs).toBeGreaterThanOrEqual(CURVE.spawnIntervalMs.end);
      expect(params.targetLifetimeMs).toBeLessThanOrEqual(CURVE.targetLifetimeMs.start);
      expect(params.targetLifetimeMs).toBeGreaterThanOrEqual(CURVE.targetLifetimeMs.end);
      expect(params.targetScale).toBeLessThanOrEqual(CURVE.targetScale.start);
      expect(params.targetScale).toBeGreaterThanOrEqual(CURVE.targetScale.end);
    }
  });

  it('never lets the spawn interval or lifetime reach zero', () => {
    const params = difficultyAt(BALANCE.round.durationMs);

    expect(params.spawnIntervalMs).toBeGreaterThan(0);
    expect(params.targetLifetimeMs).toBeGreaterThan(0);
    expect(params.targetScale).toBeGreaterThan(0);
  });

  it('always allows at least one concurrent target, as a whole number', () => {
    for (let elapsed = 0; elapsed <= BALANCE.round.durationMs; elapsed += 500) {
      const { maxConcurrent } = difficultyAt(elapsed);

      expect(Number.isInteger(maxConcurrent)).toBe(true);
      expect(maxConcurrent).toBeGreaterThanOrEqual(1);
      expect(maxConcurrent).toBeLessThanOrEqual(Math.round(CURVE.maxConcurrent.end));
    }
  });

  it('never decreases the concurrent target allowance', () => {
    let previous = 0;

    for (let elapsed = 0; elapsed <= BALANCE.round.durationMs; elapsed += 1000) {
      const { maxConcurrent } = difficultyAt(elapsed);

      expect(maxConcurrent).toBeGreaterThanOrEqual(previous);
      previous = maxConcurrent;
    }
  });

  it('accepts an alternative curve without reaching for the default', () => {
    const linear: DifficultyBalance = {
      rampDurationMs: 1000,
      easingExponent: 1,
      spawnIntervalMs: { start: 1000, end: 500 },
      targetLifetimeMs: { start: 2000, end: 1000 },
      targetScale: { start: 1, end: 0.5 },
      maxConcurrent: { start: 1, end: 4 },
    };

    const midpoint = difficultyAt(500, linear);

    expect(midpoint.progress).toBeCloseTo(0.5, 10);
    expect(midpoint.spawnIntervalMs).toBeCloseTo(750, 10);
    expect(midpoint.targetLifetimeMs).toBeCloseTo(1500, 10);
    expect(midpoint.targetScale).toBeCloseTo(0.75, 10);
  });

  it('keeps an aggressive easing exponent bounded', () => {
    const steep: DifficultyBalance = { ...CURVE, easingExponent: 8 };

    expect(difficultyProgressAt(0, steep)).toBe(0);
    expect(difficultyProgressAt(RAMP_MS, steep)).toBe(1);
    expect(difficultyProgressAt(RAMP_MS / 2, steep)).toBeGreaterThanOrEqual(0);
    expect(difficultyProgressAt(RAMP_MS / 2, steep)).toBeLessThanOrEqual(1);
  });
});
