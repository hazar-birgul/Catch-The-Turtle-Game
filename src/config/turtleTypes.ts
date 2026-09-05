import type { RampedValue } from './balance';

/**
 * Turtle variants as immutable data.
 *
 * There is deliberately no class hierarchy here. A turtle variant differs only
 * in its numbers and its look, so a subclass per variant would add indirection
 * without adding behaviour. Adding a future variant means appending one entry to
 * `TURTLE_TYPES` — the scoring and spawning systems read these fields generically
 * and contain no per-variant branching.
 */

export const TURTLE_TYPE_IDS = ['normal', 'golden'] as const;

export type TurtleTypeId = (typeof TURTLE_TYPE_IDS)[number];

export interface TurtleTypeDefinition {
  readonly id: TurtleTypeId;
  /** Player-facing name, for the game-over breakdown. */
  readonly label: string;
  /** Points before the combo multiplier is applied. */
  readonly basePoints: number;
  /** Multiplies the difficulty-driven target scale. */
  readonly scaleMultiplier: number;
  /** Multiplies the difficulty-driven target lifetime. */
  readonly lifetimeMultiplier: number;
  /**
   * Relative selection weight, ramped across the round by the same eased
   * progress the difficulty curve uses. Weights are relative to each other, not
   * probabilities — the spawn pool normalises them.
   */
  readonly spawnWeight: RampedValue;
  /**
   * Temporary flat colour used by the placeholder graphics. The art phase
   * replaces this with real textures; it exists so the two variants are
   * distinguishable before any artwork exists.
   */
  readonly placeholderColor: number;
}

const NORMAL_TURTLE: TurtleTypeDefinition = {
  id: 'normal',
  label: 'Normal',
  basePoints: 10,
  scaleMultiplier: 1,
  lifetimeMultiplier: 1,
  // Stays dominant all round, but yields a little share to the bonus target.
  spawnWeight: { start: 96, end: 90 },
  placeholderColor: 0x4ade80,
};

const GOLDEN_TURTLE: TurtleTypeDefinition = {
  id: 'golden',
  label: 'Golden',
  // Five times a Normal turtle: a genuine reward without letting one lucky
  // spawn outweigh a whole round of consistent play.
  basePoints: 50,
  scaleMultiplier: 1,
  // Rare and fleeting: the same size, but it leaves sooner, so it rewards
  // reaction rather than being simply free points.
  lifetimeMultiplier: 0.75,
  // ~4% of spawns early, rising to ~10% once the round is fully ramped.
  spawnWeight: { start: 4, end: 10 },
  placeholderColor: 0xfacc15,
};

export const TURTLE_TYPES: readonly TurtleTypeDefinition[] = [NORMAL_TURTLE, GOLDEN_TURTLE];

/** Lookup by id, for rehydrating a type from a stored or serialised value. */
export const TURTLE_TYPES_BY_ID: Readonly<Record<TurtleTypeId, TurtleTypeDefinition>> = {
  normal: NORMAL_TURTLE,
  golden: GOLDEN_TURTLE,
};
