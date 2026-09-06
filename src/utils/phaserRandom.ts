import Phaser from 'phaser';

import type { RandomSource } from '../systems/random';

/**
 * Production implementation of the `RandomSource` contract: a seeded Phaser
 * `RandomDataGenerator` behind the plain `() => number` the systems expect.
 *
 * It lives in `utils/` rather than `systems/` because it imports Phaser, and the
 * engine-free boundary the test suite depends on runs around `src/systems/**`
 * and `src/services/**`.
 */

export interface SeededRandom {
  readonly random: RandomSource;
  /** Reproduces this round's spawn sequence when passed back in. */
  readonly seed: string;
}

/** Disambiguates two rounds started in the same millisecond, e.g. a fast replay. */
let roundCounter = 0;

/**
 * The clock plus a per-session counter. The requirement is that rounds differ,
 * not that they are unpredictable, and gameplay may not call `Math.random()`.
 */
export function nextRoundSeed(): string {
  roundCounter += 1;

  return `${Date.now().toString(36)}-${roundCounter.toString(36)}`;
}

export function createSeededRandom(seed: string = nextRoundSeed()): SeededRandom {
  const generator = new Phaser.Math.RandomDataGenerator([seed]);

  return {
    random: () => generator.frac(),
    seed,
  };
}
