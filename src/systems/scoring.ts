import { BALANCE, type ComboTier } from '../config/balance';
import {
  TURTLE_TYPE_IDS,
  type TurtleTypeDefinition,
  type TurtleTypeId,
} from '../config/turtleTypes';

/**
 * Scoring, combo and round statistics.
 *
 * Every export here is a pure function over plain serialisable data. Nothing in
 * this module knows that Phaser, a canvas, or a browser exists — which is what
 * lets the whole scoring model be tested in milliseconds in Node.
 *
 * `RoundState` is treated as immutable: each `register*` function returns a new
 * state rather than mutating its argument. For a click game the allocation cost
 * is irrelevant, and it removes a whole class of "who mutated this?" bugs.
 */

export interface RoundState {
  readonly score: number;
  /** Consecutive catches without a miss or an escape. */
  readonly combo: number;
  readonly maxCombo: number;
  readonly hits: number;
  /** Player clicks that did not land on a target. */
  readonly misses: number;
  /** Targets that expired before the player reached them. */
  readonly escaped: number;
  readonly spawned: number;
  /** Catches broken down by turtle variant, for the game-over summary. */
  readonly caughtByType: Readonly<Record<TurtleTypeId, number>>;
}

/** Final, display-ready statistics derived from a finished `RoundState`. */
export interface RoundResult {
  readonly score: number;
  readonly maxCombo: number;
  readonly hits: number;
  readonly misses: number;
  readonly escaped: number;
  readonly spawned: number;
  /** Player click attempts: hits + misses. Escapes are not attempts. */
  readonly attempts: number;
  /** 0..1. See `accuracyOf` for the zero-attempt contract. */
  readonly accuracy: number;
  readonly caughtByType: Readonly<Record<TurtleTypeId, number>>;
}

/** What a hit would be worth, without applying it. Used for floating score text. */
export interface HitPreview {
  /** The combo the player will be on *after* this catch. */
  readonly combo: number;
  readonly multiplier: number;
  readonly points: number;
}

function emptyCaughtByType(): Record<TurtleTypeId, number> {
  return Object.fromEntries(TURTLE_TYPE_IDS.map((id) => [id, 0])) as Record<TurtleTypeId, number>;
}

export function createRoundState(): RoundState {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    misses: 0,
    escaped: 0,
    spawned: 0,
    caughtByType: emptyCaughtByType(),
  };
}

/**
 * The multiplier for a given combo count.
 *
 * Walks the tier staircase and returns the last tier whose threshold is met, so
 * tiers stay declarative data in `balance.ts` rather than a chain of ifs here.
 */
export function comboMultiplier(
  combo: number,
  tiers: readonly ComboTier[] = BALANCE.combo.tiers,
): number {
  let multiplier = 1;

  for (const tier of tiers) {
    if (combo >= tier.minCombo) {
      multiplier = tier.multiplier;
    } else {
      break;
    }
  }

  return multiplier;
}

/**
 * Work out what a catch is worth.
 *
 * SEMANTICS — the combo increments *before* the reward is calculated, so a catch
 * is paid at the multiplier the player has just reached. The first catch of a
 * round is combo 1 (x1); the third is combo 3, which is the first to pay x2.
 * The alternative model (pay at the previous combo, then increment) was
 * rejected because it makes the HUD lie: the player sees "x2" and is paid x1.
 */
export function previewHit(
  state: RoundState,
  turtle: TurtleTypeDefinition,
  tiers: readonly ComboTier[] = BALANCE.combo.tiers,
): HitPreview {
  const combo = state.combo + 1;
  const multiplier = comboMultiplier(combo, tiers);

  return {
    combo,
    multiplier,
    // Base points and multipliers are integers by design; rounding keeps the
    // score an integer even if a tier is ever tuned to a fractional value.
    points: Math.round(turtle.basePoints * multiplier),
  };
}

/** Record that `count` targets appeared. Affects statistics only. */
export function registerSpawn(state: RoundState, count = 1): RoundState {
  return { ...state, spawned: state.spawned + count };
}

/** Record a successful catch: scores points, extends the combo. */
export function registerHit(
  state: RoundState,
  turtle: TurtleTypeDefinition,
  tiers: readonly ComboTier[] = BALANCE.combo.tiers,
): RoundState {
  const { combo, points } = previewHit(state, turtle, tiers);

  return {
    ...state,
    score: state.score + points,
    combo,
    maxCombo: Math.max(state.maxCombo, combo),
    hits: state.hits + 1,
    caughtByType: {
      ...state.caughtByType,
      [turtle.id]: state.caughtByType[turtle.id] + 1,
    },
  };
}

/** Record a click that hit nothing. Breaks the combo and counts as an attempt. */
export function registerMiss(state: RoundState): RoundState {
  return { ...state, combo: 0, misses: state.misses + 1 };
}

/**
 * Record a target that expired uncaught. Breaks the combo, but is deliberately
 * *not* an attempt: the player never clicked, so it must not dilute accuracy.
 */
export function registerEscape(state: RoundState): RoundState {
  return { ...state, combo: 0, escaped: state.escaped + 1 };
}

/** Player click attempts: hits + misses. Escapes are excluded by design. */
export function attemptsOf(state: RoundState): number {
  return state.hits + state.misses;
}

/**
 * Click accuracy in 0..1.
 *
 * With zero attempts this returns 0 rather than NaN or 1. A player who never
 * clicked has no accuracy to show, and 0 is the value that reads correctly
 * beside a score of 0. Callers that want to distinguish "0% accuracy" from "no
 * attempts yet" should check `attempts === 0` and render a dash instead.
 */
export function accuracyOf(state: RoundState): number {
  const attempts = attemptsOf(state);

  return attempts === 0 ? 0 : state.hits / attempts;
}

/** Collapse a finished round into its display-ready statistics. */
export function summarizeRound(state: RoundState): RoundResult {
  return {
    score: state.score,
    maxCombo: state.maxCombo,
    hits: state.hits,
    misses: state.misses,
    escaped: state.escaped,
    spawned: state.spawned,
    attempts: attemptsOf(state),
    accuracy: accuracyOf(state),
    caughtByType: state.caughtByType,
  };
}
