import { describe, expect, it } from 'vitest';

import { BALANCE } from '../config/balance';
import { TURTLE_TYPES, TURTLE_TYPES_BY_ID, type TurtleTypeDefinition } from '../config/turtleTypes';
import type { RandomSource } from './random';
import {
  buildExclusionZones,
  buildSpawnPool,
  findSpawnPosition,
  selectTurtleType,
  spawnProbabilities,
  type Rect,
  type WeightedTurtleType,
} from './spawn';

/** A RandomSource that replays a fixed sequence, then repeats its last value. */
function sequence(values: readonly number[]): RandomSource {
  let index = 0;

  return () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;

    return value;
  };
}

function constant(value: number): RandomSource {
  return () => value;
}

function weighted(definition: TurtleTypeDefinition, weight: number): WeightedTurtleType {
  return { definition, weight };
}

const NORMAL = TURTLE_TYPES_BY_ID.normal;
const GOLDEN = TURTLE_TYPES_BY_ID.golden;

describe('buildSpawnPool', () => {
  it('uses each variant start weight at the beginning of the round', () => {
    const pool = buildSpawnPool(0);

    expect(pool.map((entry) => entry.weight)).toEqual([
      NORMAL.spawnWeight.start,
      GOLDEN.spawnWeight.start,
    ]);
  });

  it('uses each variant end weight once fully ramped', () => {
    const pool = buildSpawnPool(1);

    expect(pool.map((entry) => entry.weight)).toEqual([
      NORMAL.spawnWeight.end,
      GOLDEN.spawnWeight.end,
    ]);
  });

  it('interpolates linearly between the two', () => {
    const [, golden] = buildSpawnPool(0.5);

    expect(golden?.weight).toBeCloseTo((GOLDEN.spawnWeight.start + GOLDEN.spawnWeight.end) / 2, 10);
  });

  it('clamps progress outside 0..1 instead of extrapolating', () => {
    expect(buildSpawnPool(-3)).toEqual(buildSpawnPool(0));
    expect(buildSpawnPool(9)).toEqual(buildSpawnPool(1));
  });

  it('rejects a non-finite progress value', () => {
    expect(() => buildSpawnPool(Number.NaN)).toThrow(RangeError);
  });

  it('covers every configured variant', () => {
    expect(buildSpawnPool(0.5)).toHaveLength(TURTLE_TYPES.length);
  });
});

describe('spawnProbabilities', () => {
  it('normalises weights into probabilities that sum to 1', () => {
    const probabilities = spawnProbabilities(buildSpawnPool(0.5));
    const total = Object.values(probabilities).reduce((sum, value) => sum + value, 0);

    expect(total).toBeCloseTo(1, 10);
  });

  it('keeps the Golden turtle rare at the start and merely uncommon at the end', () => {
    const atStart = spawnProbabilities(buildSpawnPool(0)).golden ?? 0;
    const atEnd = spawnProbabilities(buildSpawnPool(1)).golden ?? 0;

    expect(atStart).toBeCloseTo(0.04, 4);
    expect(atEnd).toBeCloseTo(0.1, 4);
  });

  it('keeps the Golden chance inside its band for the whole round', () => {
    for (let progress = 0; progress <= 1; progress += 0.05) {
      const chance = spawnProbabilities(buildSpawnPool(progress)).golden ?? 0;

      expect(chance).toBeGreaterThanOrEqual(0.04 - 1e-9);
      expect(chance).toBeLessThanOrEqual(0.1 + 1e-9);
    }
  });

  it('never makes the bonus target more likely than the standard one', () => {
    const probabilities = spawnProbabilities(buildSpawnPool(1));

    expect(probabilities.golden ?? 0).toBeLessThan(probabilities.normal ?? 0);
  });
});

describe('selectTurtleType', () => {
  const pool = [weighted(NORMAL, 90), weighted(GOLDEN, 10)];

  it('is deterministic for a given random value', () => {
    expect(selectTurtleType(pool, constant(0.5))).toBe(NORMAL);
    expect(selectTurtleType(pool, constant(0.5))).toBe(NORMAL);
  });

  it('selects the first entry for a random value of 0', () => {
    expect(selectTurtleType(pool, constant(0))).toBe(NORMAL);
  });

  it('selects the last entry for a random value approaching 1', () => {
    expect(selectTurtleType(pool, constant(0.9999999))).toBe(GOLDEN);
  });

  it('splits exactly at the cumulative weight boundary', () => {
    // 90/100: below the boundary is Normal, at or above it is Golden.
    expect(selectTurtleType(pool, constant(0.8999999))).toBe(NORMAL);
    expect(selectTurtleType(pool, constant(0.9))).toBe(GOLDEN);
  });

  it('never selects a zero-weight entry', () => {
    const withDeadEntry = [weighted(GOLDEN, 0), weighted(NORMAL, 5)];

    for (const value of [0, 0.001, 0.25, 0.5, 0.75, 0.999999]) {
      expect(selectTurtleType(withDeadEntry, constant(value))).toBe(NORMAL);
    }
  });

  it('handles a single-entry pool', () => {
    expect(selectTurtleType([weighted(GOLDEN, 1)], constant(0.7))).toBe(GOLDEN);
  });

  it('survives a random source that breaks its contract', () => {
    // Out-of-range values are clamped rather than crashing a live round.
    expect(selectTurtleType(pool, constant(1))).toBe(GOLDEN);
    expect(selectTurtleType(pool, constant(-1))).toBe(NORMAL);
    expect(selectTurtleType(pool, constant(Number.NaN))).toBe(NORMAL);
  });

  it('rejects an empty pool', () => {
    expect(() => selectTurtleType([], constant(0.5))).toThrow(RangeError);
  });

  it('rejects a pool whose weights are all zero', () => {
    expect(() => selectTurtleType([weighted(NORMAL, 0)], constant(0.5))).toThrow(RangeError);
  });

  it('rejects a negative weight rather than skewing every future spawn', () => {
    expect(() =>
      selectTurtleType([weighted(NORMAL, -1), weighted(GOLDEN, 5)], constant(0.5)),
    ).toThrow(RangeError);
  });

  it('rejects a non-finite weight', () => {
    expect(() => selectTurtleType([weighted(NORMAL, Number.NaN)], constant(0.5))).toThrow(
      RangeError,
    );
    expect(() =>
      selectTurtleType([weighted(NORMAL, Number.POSITIVE_INFINITY)], constant(0.5)),
    ).toThrow(RangeError);
  });

  it('produces roughly the configured distribution over many draws', () => {
    const draws = 10_000;
    let goldenCount = 0;

    for (let i = 0; i < draws; i += 1) {
      // Deterministic sweep across [0, 1) rather than a real RNG.
      if (selectTurtleType(pool, constant(i / draws)) === GOLDEN) {
        goldenCount += 1;
      }
    }

    expect(goldenCount / draws).toBeCloseTo(0.1, 2);
  });
});

describe('buildExclusionZones', () => {
  const area = { width: 960, height: 540 };

  it('reserves the HUD bands described by the balance config', () => {
    const zones = buildExclusionZones(area);

    expect(zones).toEqual([
      { x: 0, y: 0, width: 960, height: BALANCE.spawn.hudSafeTopPx },
      {
        x: 0,
        y: 540 - BALANCE.spawn.hudSafeBottomPx,
        width: 960,
        height: BALANCE.spawn.hudSafeBottomPx,
      },
    ]);
  });

  it('omits a band that is configured to zero height', () => {
    const zones = buildExclusionZones(area, {
      ...BALANCE.spawn,
      hudSafeTopPx: 0,
      hudSafeBottomPx: 0,
    });

    expect(zones).toEqual([]);
  });
});

describe('findSpawnPosition', () => {
  const area = { width: 960, height: 540 };

  it('places a target deterministically for a given random sequence', () => {
    // 0.5, 0.5 with radius 40 and margin 20 lands in the middle of the usable box.
    const position = findSpawnPosition({
      area,
      targetRadius: 40,
      margin: 20,
      minSeparation: 0,
      random: sequence([0.5, 0.5]),
    });

    expect(position).toEqual({ x: 480, y: 270 });
  });

  it('returns the same position for the same sequence', () => {
    const request = { area, targetRadius: 30, margin: 10, minSeparation: 0 };

    const first = findSpawnPosition({ ...request, random: sequence([0.31, 0.72]) });
    const second = findSpawnPosition({ ...request, random: sequence([0.31, 0.72]) });

    expect(first).toEqual(second);
  });

  it('keeps the whole target inside the margins at the extremes', () => {
    const lowCorner = findSpawnPosition({
      area,
      targetRadius: 40,
      margin: 20,
      minSeparation: 0,
      random: constant(0),
    });

    expect(lowCorner).toEqual({ x: 60, y: 60 });

    const highCorner = findSpawnPosition({
      area,
      targetRadius: 40,
      margin: 20,
      minSeparation: 0,
      random: constant(0.9999999999999999),
    });

    expect(highCorner?.x).toBeCloseTo(900, 6);
    expect(highCorner?.y).toBeCloseTo(480, 6);
  });

  it('never places a target where any part would leave the play area', () => {
    const radius = 36;
    const margin = 12;

    for (let i = 0; i <= 40; i += 1) {
      const value = i / 40;
      const position = findSpawnPosition({
        area,
        targetRadius: radius,
        margin,
        minSeparation: 0,
        random: constant(value),
      });

      expect(position).not.toBeNull();
      expect(position?.x).toBeGreaterThanOrEqual(radius + margin);
      expect(position?.x).toBeLessThanOrEqual(area.width - radius - margin);
      expect(position?.y).toBeGreaterThanOrEqual(radius + margin);
      expect(position?.y).toBeLessThanOrEqual(area.height - radius - margin);
    }
  });

  it('rejects candidates that fall under an exclusion zone', () => {
    const hud: Rect = { x: 0, y: 0, width: 960, height: 200 };

    // First candidate is high on the screen and blocked; second is clear.
    const position = findSpawnPosition({
      area,
      targetRadius: 20,
      margin: 0,
      exclusionZones: [hud],
      minSeparation: 0,
      random: sequence([0.5, 0.05, 0.5, 0.9]),
    });

    expect(position).not.toBeNull();
    expect(position?.y).toBeGreaterThan(hud.height);
  });

  it('honours the real HUD bands from the balance config', () => {
    const zones = buildExclusionZones(area);

    for (let i = 0; i <= 30; i += 1) {
      const position = findSpawnPosition({
        area,
        targetRadius: 30,
        exclusionZones: zones,
        minSeparation: 0,
        random: constant(i / 30),
      });

      if (position !== null) {
        expect(position.y - 30).toBeGreaterThanOrEqual(BALANCE.spawn.hudSafeTopPx);
        expect(position.y + 30).toBeLessThanOrEqual(area.height - BALANCE.spawn.hudSafeBottomPx);
      }
    }
  });

  it('keeps its distance from targets already on screen', () => {
    const anchor = { x: 480, y: 270 };
    const existing = [anchor];

    // The first candidate lands on top of the existing target and is rejected.
    const position = findSpawnPosition({
      area,
      targetRadius: 20,
      margin: 20,
      existingPositions: existing,
      minSeparation: 200,
      random: sequence([0.5, 0.5, 0.02, 0.02]),
    });

    expect(position).not.toBeNull();

    const dx = (position?.x ?? 0) - anchor.x;
    const dy = (position?.y ?? 0) - anchor.y;

    expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(200);
  });

  it('ignores separation entirely when it is zero', () => {
    const position = findSpawnPosition({
      area,
      targetRadius: 20,
      margin: 20,
      existingPositions: [{ x: 480, y: 270 }],
      minSeparation: 0,
      random: sequence([0.5, 0.5]),
    });

    expect(position).toEqual({ x: 480, y: 270 });
  });

  it('gives up and returns null once the attempt budget is spent', () => {
    // Every candidate lands on the excluded centre, so nothing is ever valid.
    const position = findSpawnPosition({
      area,
      targetRadius: 10,
      margin: 0,
      exclusionZones: [{ x: 0, y: 0, width: 960, height: 540 }],
      minSeparation: 0,
      maxAttempts: 5,
      random: constant(0.5),
    });

    expect(position).toBeNull();
  });

  it('consumes at most two random values per attempt', () => {
    let calls = 0;
    const counting: RandomSource = () => {
      calls += 1;

      return 0.5;
    };

    findSpawnPosition({
      area,
      targetRadius: 10,
      margin: 0,
      exclusionZones: [{ x: 0, y: 0, width: 960, height: 540 }],
      minSeparation: 0,
      maxAttempts: 4,
      random: counting,
    });

    expect(calls).toBe(8);
  });

  it('returns null when the target is larger than the play area', () => {
    const position = findSpawnPosition({
      area: { width: 100, height: 100 },
      targetRadius: 80,
      margin: 10,
      minSeparation: 0,
      random: constant(0.5),
    });

    expect(position).toBeNull();
  });

  it('returns null when margins leave no room at all', () => {
    const position = findSpawnPosition({
      area: { width: 100, height: 100 },
      targetRadius: 10,
      margin: 45,
      minSeparation: 0,
      random: constant(0.5),
    });

    expect(position).toBeNull();
  });

  it('places a target that exactly fits', () => {
    const position = findSpawnPosition({
      area: { width: 100, height: 100 },
      targetRadius: 50,
      margin: 0,
      minSeparation: 0,
      random: constant(0.5),
    });

    expect(position).toEqual({ x: 50, y: 50 });
  });

  it('throws rather than producing NaN coordinates for an invalid area', () => {
    const base = { targetRadius: 10, minSeparation: 0, random: constant(0.5) };

    expect(() => findSpawnPosition({ ...base, area: { width: 0, height: 540 } })).toThrow(
      RangeError,
    );
    expect(() => findSpawnPosition({ ...base, area: { width: 960, height: 0 } })).toThrow(
      RangeError,
    );
    expect(() => findSpawnPosition({ ...base, area: { width: -10, height: 540 } })).toThrow(
      RangeError,
    );
    expect(() => findSpawnPosition({ ...base, area: { width: Number.NaN, height: 540 } })).toThrow(
      RangeError,
    );
  });

  it('throws for negative sizing inputs', () => {
    const base = { area, minSeparation: 0, random: constant(0.5) };

    expect(() => findSpawnPosition({ ...base, targetRadius: -1 })).toThrow(RangeError);
    expect(() => findSpawnPosition({ ...base, targetRadius: 10, margin: -1 })).toThrow(RangeError);
    expect(() => findSpawnPosition({ ...base, targetRadius: 10, minSeparation: -1 })).toThrow(
      RangeError,
    );
  });

  it('throws for a nonsensical attempt budget', () => {
    const base = { area, targetRadius: 10, minSeparation: 0, random: constant(0.5) };

    expect(() => findSpawnPosition({ ...base, maxAttempts: 0 })).toThrow(RangeError);
    expect(() => findSpawnPosition({ ...base, maxAttempts: -3 })).toThrow(RangeError);
    expect(() => findSpawnPosition({ ...base, maxAttempts: 2.5 })).toThrow(RangeError);
  });

  it('never returns NaN coordinates for any valid input', () => {
    for (let i = 0; i <= 20; i += 1) {
      const position = findSpawnPosition({
        area,
        targetRadius: 25,
        exclusionZones: buildExclusionZones(area),
        existingPositions: [{ x: 300, y: 300 }],
        random: constant(i / 20),
      });

      if (position !== null) {
        expect(Number.isFinite(position.x)).toBe(true);
        expect(Number.isFinite(position.y)).toBe(true);
      }
    }
  });
});
