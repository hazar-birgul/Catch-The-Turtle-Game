/**
 * Randomness contract for the gameplay systems.
 *
 * Gameplay code never calls `Math.random()`. Every function that needs
 * randomness takes a `RandomSource`, which means production can supply Phaser's
 * seeded generator (or anything else) while tests supply a fixed sequence and
 * assert exact outcomes.
 *
 * We deliberately do not implement a random-number generator here — injection is
 * the whole requirement, and writing our own PRNG would be code to maintain for
 * no benefit.
 */

/** Returns a number in the half-open interval [0, 1), like `Math.random`. */
export type RandomSource = () => number;

/** The largest double strictly below 1, used to keep the interval half-open. */
const LARGEST_BELOW_ONE = 0.9999999999999999;

/**
 * Read one value from a `RandomSource`, defending against a source that breaks
 * the contract.
 *
 * A malformed value from the RNG is a runtime condition rather than a
 * configuration error: throwing here would crash a running game, so the value is
 * clamped into [0, 1) instead. `NaN` and negatives clamp to 0; values at or
 * above 1 clamp just below 1, so callers can always scale by a length safely.
 */
export function nextUnitInterval(random: RandomSource): number {
  const value = random();

  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value < 1 ? value : LARGEST_BELOW_ONE;
}
