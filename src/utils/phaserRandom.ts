import Phaser from 'phaser';

import type { RandomSource } from '../systems/random';

/**
 * The Phaser side of the randomness contract.
 *
 * `src/systems/*` never calls `Math.random()` and never imports Phaser — it takes
 * a `RandomSource` and lets the caller decide where the numbers come from. This
 * module is the production implementation of that contract: a seeded Phaser
 * `RandomDataGenerator` wrapped in the plain `() => number` the systems expect.
 *
 * It lives in `utils/` rather than `systems/` precisely because it imports
 * Phaser. The engine boundary the test suite depends on runs around
 * `src/systems/**` and `src/services/**`, and this file is deliberately outside it.
 */

export interface SeededRandom {
  /** The `RandomSource` to hand to the gameplay systems. */
  readonly random: RandomSource;
  /** The seed actually used. Useful for reproducing a round while debugging. */
  readonly seed: string;
}

/**
 * Disambiguates two rounds started in the same millisecond — a replay tapped
 * quickly, for instance — so no two rounds share a spawn sequence by accident.
 */
let roundCounter = 0;

/**
 * A seed that differs between rounds without reaching for `Math.random()`.
 *
 * The clock plus a per-session counter is enough: the requirement is that a
 * player does not get the identical spawn sequence on every launch, not
 * cryptographic unpredictability.
 */
export function nextRoundSeed(): string {
  roundCounter += 1;

  return `${Date.now().toString(36)}-${roundCounter.toString(36)}`;
}

/**
 * Build a seeded `RandomSource`.
 *
 * Passing an explicit seed reproduces a spawn sequence exactly, which is what
 * makes a reported "the turtles bunched up in this round" reproducible.
 */
export function createSeededRandom(seed: string = nextRoundSeed()): SeededRandom {
  const generator = new Phaser.Math.RandomDataGenerator([seed]);

  return {
    random: () => generator.frac(),
    seed,
  };
}
