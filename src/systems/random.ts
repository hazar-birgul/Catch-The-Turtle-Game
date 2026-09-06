/**
 * Randomness contract for the gameplay systems.
 *
 * Gameplay never calls `Math.random()`. Every function that needs randomness
 * takes a `RandomSource`, so production injects Phaser's seeded generator while
 * tests inject a fixed sequence and assert exact outcomes.
 */

/** Returns a number in [0, 1), like `Math.random`. */
export type RandomSource = () => number;

const LARGEST_BELOW_ONE = 0.9999999999999999;

/**
 * Read one value, clamping a source that breaks the contract.
 *
 * A malformed RNG value is a runtime condition rather than a configuration
 * error, so it is clamped instead of thrown on: throwing would crash a live
 * round. Callers can always scale the result by a length safely.
 */
export function nextUnitInterval(random: RandomSource): number {
  const value = random();

  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value < 1 ? value : LARGEST_BELOW_ONE;
}
