import { BALANCE, type DifficultyBalance, type RampedValue } from '../config/balance';

/**
 * Progressive difficulty.
 *
 * The legacy game picked one of three fixed speeds at a menu and never changed
 * it. Here difficulty is a pure function of elapsed round time, so it is fully
 * deterministic, trivially testable, and has no state of its own to get out of
 * sync with the round.
 */

export interface DifficultyParams {
  /** Eased ramp progress in 0..1. Also drives spawn-pool weighting. */
  readonly progress: number;
  readonly spawnIntervalMs: number;
  readonly targetLifetimeMs: number;
  readonly targetScale: number;
  /** Always an integer of at least 1. */
  readonly maxConcurrent: number;
}

function clamp01(value: number): number {
  // NaN has no meaningful position on the ramp, so it starts the round. An
  // infinite elapsed time is genuinely past the end, so it clamps to fully
  // ramped rather than falling back to the start.
  if (Number.isNaN(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  return value < 1 ? value : 1;
}

function lerp(range: RampedValue, t: number): number {
  return range.start + (range.end - range.start) * t;
}

/**
 * Eased ramp progress for a point in the round.
 *
 * `p = clamp(elapsedMs / rampDurationMs, 0, 1)`, then `p ** easingExponent`.
 * Negative and past-the-end elapsed values clamp to the endpoints rather than
 * extrapolating, so a mis-timed call can never produce out-of-range parameters.
 * An exponent above 1 back-loads the ramp: the opening stays approachable and
 * the pressure builds late.
 */
export function difficultyProgressAt(
  elapsedMs: number,
  config: DifficultyBalance = BALANCE.difficulty,
): number {
  const linear = clamp01(elapsedMs / config.rampDurationMs);

  return clamp01(linear ** config.easingExponent);
}

/**
 * The gameplay parameters in force at a point in the round.
 *
 * Every value is interpolated between its start and end setting in `balance.ts`;
 * this function contains no tuning numbers of its own.
 */
export function difficultyAt(
  elapsedMs: number,
  config: DifficultyBalance = BALANCE.difficulty,
): DifficultyParams {
  const progress = difficultyProgressAt(elapsedMs, config);

  return {
    progress,
    spawnIntervalMs: lerp(config.spawnIntervalMs, progress),
    targetLifetimeMs: lerp(config.targetLifetimeMs, progress),
    targetScale: lerp(config.targetScale, progress),
    // Concurrency is a count, so it must be a whole number, and at least one
    // target must always be allowed or the round would stall.
    maxConcurrent: Math.max(1, Math.round(lerp(config.maxConcurrent, progress))),
  };
}
