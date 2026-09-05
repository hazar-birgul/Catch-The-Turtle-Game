import { describe, expect, it } from 'vitest';

import type { ComboTier } from '../config/balance';
import { TURTLE_TYPES_BY_ID } from '../config/turtleTypes';
import {
  accuracyOf,
  attemptsOf,
  comboMultiplier,
  createRoundState,
  previewHit,
  registerEscape,
  registerHit,
  registerMiss,
  registerSpawn,
  summarizeRound,
  type RoundState,
} from './scoring';

const NORMAL = TURTLE_TYPES_BY_ID.normal;
const GOLDEN = TURTLE_TYPES_BY_ID.golden;

/** Apply `count` consecutive catches of the same variant. */
function catchTimes(state: RoundState, count: number, turtle = NORMAL): RoundState {
  let next = state;

  for (let i = 0; i < count; i += 1) {
    next = registerHit(next, turtle);
  }

  return next;
}

describe('createRoundState', () => {
  it('starts everything at zero', () => {
    const state = createRoundState();

    expect(state).toEqual({
      score: 0,
      combo: 0,
      maxCombo: 0,
      hits: 0,
      misses: 0,
      escaped: 0,
      spawned: 0,
      caughtByType: { normal: 0, golden: 0 },
    });
  });

  it('returns an independent state each time', () => {
    const first = createRoundState();
    const second = createRoundState();

    expect(first).not.toBe(second);
    expect(first.caughtByType).not.toBe(second.caughtByType);
  });
});

describe('comboMultiplier', () => {
  it('applies the default tier staircase', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(2)).toBe(1);
    expect(comboMultiplier(3)).toBe(2);
    expect(comboMultiplier(5)).toBe(2);
    expect(comboMultiplier(6)).toBe(3);
    expect(comboMultiplier(9)).toBe(3);
    expect(comboMultiplier(10)).toBe(4);
  });

  it('caps at the highest tier however long the streak runs', () => {
    expect(comboMultiplier(50)).toBe(4);
    expect(comboMultiplier(1000)).toBe(4);
  });

  it('accepts a custom tier table', () => {
    const tiers: ComboTier[] = [
      { minCombo: 0, multiplier: 1 },
      { minCombo: 2, multiplier: 5 },
    ];

    expect(comboMultiplier(1, tiers)).toBe(1);
    expect(comboMultiplier(2, tiers)).toBe(5);
    expect(comboMultiplier(99, tiers)).toBe(5);
  });
});

describe('registerSpawn', () => {
  it('counts spawns without touching score or combo', () => {
    const state = registerSpawn(createRoundState());

    expect(state.spawned).toBe(1);
    expect(state.score).toBe(0);
    expect(state.combo).toBe(0);
  });

  it('can record several spawns at once', () => {
    expect(registerSpawn(createRoundState(), 3).spawned).toBe(3);
  });
});

describe('registerHit', () => {
  it('scores the first catch at x1 and sets the combo to 1', () => {
    const state = registerHit(createRoundState(), NORMAL);

    expect(state.combo).toBe(1);
    expect(state.maxCombo).toBe(1);
    expect(state.hits).toBe(1);
    expect(state.score).toBe(10);
    expect(state.caughtByType.normal).toBe(1);
  });

  it('increments the combo before paying, so the third catch pays x2', () => {
    // 10 + 10 + (10 * 2) = 40
    expect(catchTimes(createRoundState(), 3).score).toBe(40);
  });

  it('reaches each multiplier tier at the documented catch', () => {
    // Tier boundaries: catches 1-2 pay x1, 3-5 pay x2, 6-9 pay x3, 10+ pay x4.
    const cumulative = [10, 20, 40, 60, 80, 110, 140, 170, 200, 240];

    let state = createRoundState();

    cumulative.forEach((expected, index) => {
      state = registerHit(state, NORMAL);
      expect(state.combo).toBe(index + 1);
      expect(state.score).toBe(expected);
    });
  });

  it('scores a Golden turtle at five times a Normal one', () => {
    const normal = registerHit(createRoundState(), NORMAL);
    const golden = registerHit(createRoundState(), GOLDEN);

    expect(normal.score).toBe(10);
    expect(golden.score).toBe(50);
    expect(golden.caughtByType.golden).toBe(1);
    expect(golden.caughtByType.normal).toBe(0);
  });

  it('applies the combo multiplier to Golden turtles too', () => {
    const state = registerHit(catchTimes(createRoundState(), 9), GOLDEN);

    // Tenth catch => combo 10 => x4 => 50 * 4.
    expect(state.combo).toBe(10);
    expect(state.score).toBe(200 + 50 * 4);
  });

  it('tracks catches per variant independently', () => {
    let state = createRoundState();
    state = registerHit(state, NORMAL);
    state = registerHit(state, GOLDEN);
    state = registerHit(state, NORMAL);

    expect(state.caughtByType).toEqual({ normal: 2, golden: 1 });
    expect(state.hits).toBe(3);
  });

  it('does not mutate the state it was given', () => {
    const before = createRoundState();
    const after = registerHit(before, NORMAL);

    expect(before.score).toBe(0);
    expect(before.combo).toBe(0);
    expect(before.caughtByType.normal).toBe(0);
    expect(after).not.toBe(before);
  });
});

describe('previewHit', () => {
  it('reports the combo, multiplier and points a catch would produce', () => {
    const state = catchTimes(createRoundState(), 2);

    expect(previewHit(state, NORMAL)).toEqual({ combo: 3, multiplier: 2, points: 20 });
  });

  it('agrees with what registerHit actually awards', () => {
    const state = catchTimes(createRoundState(), 7);
    const preview = previewHit(state, GOLDEN);
    const applied = registerHit(state, GOLDEN);

    expect(applied.score - state.score).toBe(preview.points);
    expect(applied.combo).toBe(preview.combo);
  });
});

describe('registerMiss', () => {
  it('breaks the combo and counts an attempt', () => {
    const state = registerMiss(catchTimes(createRoundState(), 6));

    expect(state.combo).toBe(0);
    expect(state.misses).toBe(1);
    expect(state.hits).toBe(6);
  });

  it('preserves the score and the best combo reached', () => {
    const state = registerMiss(catchTimes(createRoundState(), 6));

    expect(state.score).toBe(110);
    expect(state.maxCombo).toBe(6);
  });

  it('drops the player back to x1 for the next catch', () => {
    const state = registerHit(registerMiss(catchTimes(createRoundState(), 6)), NORMAL);

    expect(state.combo).toBe(1);
    expect(state.score).toBe(110 + 10);
  });
});

describe('registerEscape', () => {
  it('breaks the combo', () => {
    const state = registerEscape(catchTimes(createRoundState(), 4));

    expect(state.combo).toBe(0);
    expect(state.escaped).toBe(1);
    expect(state.maxCombo).toBe(4);
  });

  it('is not a click attempt, so it does not dilute accuracy', () => {
    const state = registerEscape(registerEscape(catchTimes(createRoundState(), 2)));

    expect(attemptsOf(state)).toBe(2);
    expect(accuracyOf(state)).toBe(1);
  });
});

describe('maxCombo', () => {
  it('remembers the best streak across several breaks', () => {
    let state = catchTimes(createRoundState(), 7);
    state = registerMiss(state);
    state = catchTimes(state, 3);
    state = registerEscape(state);
    state = catchTimes(state, 2);

    expect(state.maxCombo).toBe(7);
    expect(state.combo).toBe(2);
  });
});

describe('accuracyOf', () => {
  it('is hits over hits plus misses', () => {
    let state = catchTimes(createRoundState(), 3);
    state = registerMiss(state);

    expect(attemptsOf(state)).toBe(4);
    expect(accuracyOf(state)).toBeCloseTo(0.75, 10);
  });

  it('returns 0 rather than NaN when nothing has been clicked', () => {
    const state = createRoundState();

    expect(attemptsOf(state)).toBe(0);
    expect(accuracyOf(state)).toBe(0);
    expect(Number.isNaN(accuracyOf(state))).toBe(false);
  });

  it('stays 0 when only escapes have happened', () => {
    const state = registerEscape(registerSpawn(createRoundState()));

    expect(attemptsOf(state)).toBe(0);
    expect(accuracyOf(state)).toBe(0);
  });

  it('is 1 for a flawless round and 0 for an all-miss round', () => {
    expect(accuracyOf(catchTimes(createRoundState(), 5))).toBe(1);
    expect(accuracyOf(registerMiss(registerMiss(createRoundState())))).toBe(0);
  });
});

describe('summarizeRound', () => {
  it('collapses a played round into its final statistics', () => {
    let state = registerSpawn(createRoundState(), 10);
    state = catchTimes(state, 4);
    state = registerHit(state, GOLDEN);
    state = registerMiss(state);
    state = registerEscape(state);

    const result = summarizeRound(state);

    expect(result).toEqual({
      // 10 + 10 + 20 + 20 (combo 4 -> x2) then combo 5 -> x2 on a Golden: 50 * 2.
      score: 60 + 100,
      maxCombo: 5,
      hits: 5,
      misses: 1,
      escaped: 1,
      spawned: 10,
      attempts: 6,
      accuracy: 5 / 6,
      caughtByType: { normal: 4, golden: 1 },
    });
  });

  it('summarises an untouched round without producing NaN', () => {
    const result = summarizeRound(createRoundState());

    expect(result.attempts).toBe(0);
    expect(result.accuracy).toBe(0);
    expect(result.score).toBe(0);
  });
});
