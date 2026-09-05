import { describe, expect, it } from 'vitest';

import { BALANCE, validateBalance, type Balance } from './balance';
import { GAME_HEIGHT } from './dimensions';
import { TURTLE_TYPES, TURTLE_TYPES_BY_ID } from './turtleTypes';

describe('validateBalance', () => {
  it('accepts the shipped configuration', () => {
    expect(validateBalance(BALANCE)).toEqual([]);
  });

  it('rejects a non-positive round duration', () => {
    const broken: Balance = { ...BALANCE, round: { durationMs: 0 } };

    expect(validateBalance(broken)).toContain(
      'round.durationMs must be a positive finite number (received 0)',
    );
  });

  it('rejects a round that gets easier over time', () => {
    const broken: Balance = {
      ...BALANCE,
      difficulty: { ...BALANCE.difficulty, spawnIntervalMs: { start: 500, end: 1500 } },
    };

    expect(validateBalance(broken)).toContain(
      'difficulty.spawnIntervalMs must not increase over the round',
    );
  });

  it('rejects a lifetime or concurrency curve pointing the wrong way', () => {
    const longerLifetime: Balance = {
      ...BALANCE,
      difficulty: { ...BALANCE.difficulty, targetLifetimeMs: { start: 500, end: 2000 } },
    };
    const fewerTargets: Balance = {
      ...BALANCE,
      difficulty: { ...BALANCE.difficulty, maxConcurrent: { start: 4, end: 1 } },
    };

    expect(validateBalance(longerLifetime)).toContain(
      'difficulty.targetLifetimeMs must not increase over the round',
    );
    expect(validateBalance(fewerTargets)).toContain(
      'difficulty.maxConcurrent must not decrease over the round',
    );
  });

  it('rejects unsorted combo tiers', () => {
    const broken: Balance = {
      ...BALANCE,
      combo: {
        tiers: [
          { minCombo: 0, multiplier: 1 },
          { minCombo: 8, multiplier: 3 },
          { minCombo: 4, multiplier: 2 },
        ],
      },
    };

    expect(validateBalance(broken)).toContain('combo.tiers must be sorted by ascending minCombo');
  });

  it('rejects a tier table that does not start at zero', () => {
    const broken: Balance = {
      ...BALANCE,
      combo: { tiers: [{ minCombo: 2, multiplier: 1 }] },
    };

    expect(validateBalance(broken)).toContain(
      'combo.tiers must start at minCombo 0 so every combo has a multiplier',
    );
  });

  it('rejects multipliers that shrink as the combo grows', () => {
    const broken: Balance = {
      ...BALANCE,
      combo: {
        tiers: [
          { minCombo: 0, multiplier: 3 },
          { minCombo: 5, multiplier: 2 },
        ],
      },
    };

    expect(validateBalance(broken)).toContain(
      'combo.tiers multipliers must not decrease as the combo grows',
    );
  });

  it('rejects an out-of-range default volume', () => {
    const broken: Balance = { ...BALANCE, audio: { ...BALANCE.audio, defaultVolume: 1.5 } };

    expect(validateBalance(broken)).toContain('audio.defaultVolume must be within 0..1');
  });

  it('rejects negative spawn geometry', () => {
    const broken: Balance = { ...BALANCE, spawn: { ...BALANCE.spawn, minSeparationPx: -1 } };

    expect(validateBalance(broken)).toContain('spawn.minSeparationPx must not be negative');
  });

  it('rejects a target with no size, which would break placement and hit testing', () => {
    const broken: Balance = { ...BALANCE, spawn: { ...BALANCE.spawn, targetBaseRadiusPx: 0 } };

    expect(validateBalance(broken)).toContain(
      'spawn.targetBaseRadiusPx must be a positive finite number (received 0)',
    );
  });

  it('rejects a negative opening delay', () => {
    const broken: Balance = { ...BALANCE, spawn: { ...BALANCE.spawn, firstSpawnDelayMs: -1 } };

    expect(validateBalance(broken)).toContain(
      'spawn.firstSpawnDelayMs must be a non-negative finite number',
    );
  });

  it('accepts an opening delay of zero, which spawns on the first tick', () => {
    const immediate: Balance = { ...BALANCE, spawn: { ...BALANCE.spawn, firstSpawnDelayMs: 0 } };

    expect(validateBalance(immediate)).toEqual([]);
  });
});

describe('shipped balance sanity', () => {
  it('runs a 60-second round, as the locked product decision requires', () => {
    expect(BALANCE.round.durationMs).toBe(60_000);
  });

  it('finishes ramping before the round ends, so the finish is played at full pace', () => {
    expect(BALANCE.difficulty.rampDurationMs).toBeLessThan(BALANCE.round.durationMs);
  });

  it('leaves a usable spawn band between the HUD keep-out zones', () => {
    const { hudSafeTopPx, hudSafeBottomPx, marginPx, targetBaseRadiusPx } = BALANCE.spawn;
    // `findSpawnPosition` inflates each exclusion zone by the target radius, so a
    // full-size target needs this much clear height between the two HUD bands.
    const consumed = hudSafeTopPx + hudSafeBottomPx + 4 * targetBaseRadiusPx + 2 * marginPx;

    expect(consumed).toBeLessThan(GAME_HEIGHT);
  });

  it('caps the combo multiplier so one streak cannot dwarf a whole round', () => {
    const multipliers = BALANCE.combo.tiers.map((tier) => tier.multiplier);

    expect(Math.max(...multipliers)).toBeLessThanOrEqual(4);
  });
});

describe('turtle type definitions', () => {
  it('gives every variant a unique id', () => {
    const ids = TURTLE_TYPES.map((type) => type.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('indexes every variant by its own id', () => {
    for (const type of TURTLE_TYPES) {
      expect(TURTLE_TYPES_BY_ID[type.id]).toBe(type);
    }
  });

  it('makes the Golden turtle worth substantially more than a Normal one', () => {
    expect(TURTLE_TYPES_BY_ID.golden.basePoints).toBeGreaterThan(
      TURTLE_TYPES_BY_ID.normal.basePoints,
    );
    expect(TURTLE_TYPES_BY_ID.golden.basePoints).toBeGreaterThanOrEqual(
      TURTLE_TYPES_BY_ID.normal.basePoints * 3,
    );
  });

  it('makes the Golden turtle significantly rarer at every point in the round', () => {
    const normal = TURTLE_TYPES_BY_ID.normal.spawnWeight;
    const golden = TURTLE_TYPES_BY_ID.golden.spawnWeight;

    expect(golden.start).toBeLessThan(normal.start);
    expect(golden.end).toBeLessThan(normal.end);
  });

  it('makes the bonus target grow more common as the round progresses', () => {
    const golden = TURTLE_TYPES_BY_ID.golden.spawnWeight;

    expect(golden.end).toBeGreaterThan(golden.start);
  });

  it('keeps every weight and multiplier usable', () => {
    for (const type of TURTLE_TYPES) {
      expect(type.spawnWeight.start).toBeGreaterThanOrEqual(0);
      expect(type.spawnWeight.end).toBeGreaterThanOrEqual(0);
      expect(type.basePoints).toBeGreaterThan(0);
      expect(type.scaleMultiplier).toBeGreaterThan(0);
      expect(type.lifetimeMultiplier).toBeGreaterThan(0);
      expect(Number.isInteger(type.basePoints)).toBe(true);
    }
  });
});
