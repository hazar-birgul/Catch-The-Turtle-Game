import { BALANCE, type SpawnBalance } from '../config/balance';
import { TURTLE_TYPES, type TurtleTypeDefinition, type TurtleTypeId } from '../config/turtleTypes';
import { nextUnitInterval, type RandomSource } from './random';

/**
 * Spawn selection and placement.
 *
 * Two independent concerns, both pure and both deterministic for a given
 * `RandomSource`: *what* to spawn (weighted variant selection) and *where* to
 * put it (rejection-sampled placement).
 *
 * Neither knows anything about Phaser. Placement receives a plain rectangle and
 * returns a plain `{ x, y }`, so a caller hands it the logical playfield and gets
 * coordinates back without this module importing the engine.
 */

export interface SpawnPosition {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PlayArea {
  readonly width: number;
  readonly height: number;
}

/** One candidate in a weighted selection pool. */
export interface WeightedTurtleType {
  readonly definition: TurtleTypeDefinition;
  readonly weight: number;
}

export interface SpawnPlacementRequest {
  readonly area: PlayArea;
  /** Half the target's on-screen size; keeps the whole sprite inside the area. */
  readonly targetRadius: number;
  readonly margin?: number;
  /** Regions nothing may spawn under, such as the HUD band. */
  readonly exclusionZones?: readonly Rect[];
  /** Centres of targets already on screen. */
  readonly existingPositions?: readonly SpawnPosition[];
  readonly minSeparation?: number;
  readonly maxAttempts?: number;
  readonly random: RandomSource;
}

function requireFinite(label: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number (received ${String(value)})`);
  }
}

function requireNonNegative(label: string, value: number): void {
  requireFinite(label, value);

  if (value < 0) {
    throw new RangeError(`${label} must not be negative (received ${String(value)})`);
  }
}

/* ------------------------------------------------------------------ *
 * Variant selection
 * ------------------------------------------------------------------ */

/**
 * Build the weighted pool for a point in the round.
 *
 * Each variant's weight is interpolated between its own start and end settings
 * using the eased difficulty progress, which is how the Golden turtle becomes
 * gradually more common without any variant-specific code in this pipeline.
 * Adding a future variant means adding a definition — nothing here changes.
 */
export function buildSpawnPool(
  progress: number,
  definitions: readonly TurtleTypeDefinition[] = TURTLE_TYPES,
): WeightedTurtleType[] {
  requireFinite('progress', progress);

  const t = Math.min(Math.max(progress, 0), 1);

  return definitions.map((definition) => ({
    definition,
    weight:
      definition.spawnWeight.start +
      (definition.spawnWeight.end - definition.spawnWeight.start) * t,
  }));
}

/**
 * Normalised selection probabilities for a pool.
 *
 * Not used by selection itself — it exists so the HUD, telemetry and tests can
 * assert what the pool actually does (for example, that the Golden turtle stays
 * within its intended rarity band across the whole round).
 */
export function spawnProbabilities(
  pool: readonly WeightedTurtleType[],
): Partial<Record<TurtleTypeId, number>> {
  const total = totalWeightOf(pool);
  const probabilities: Partial<Record<TurtleTypeId, number>> = {};

  for (const entry of pool) {
    probabilities[entry.definition.id] = entry.weight / total;
  }

  return probabilities;
}

function totalWeightOf(pool: readonly WeightedTurtleType[]): number {
  if (pool.length === 0) {
    throw new RangeError('Spawn pool must not be empty');
  }

  let total = 0;

  for (const entry of pool) {
    const { weight } = entry;

    // Invalid weights are a configuration error, not a runtime condition, so
    // they fail loudly rather than silently skewing every future spawn.
    if (!Number.isFinite(weight)) {
      throw new RangeError(
        `Spawn weight for "${entry.definition.id}" must be finite (received ${String(weight)})`,
      );
    }
    if (weight < 0) {
      throw new RangeError(
        `Spawn weight for "${entry.definition.id}" must not be negative (received ${String(weight)})`,
      );
    }

    total += weight;
  }

  if (total <= 0) {
    throw new RangeError('Spawn pool must contain at least one entry with a positive weight');
  }

  return total;
}

/**
 * Pick a variant from a weighted pool.
 *
 * Deterministic for a given random value. Entries with zero weight can never be
 * selected. The trailing fallback covers floating-point summation error, so a
 * value very close to 1 always resolves to a real entry rather than falling off
 * the end.
 */
export function selectTurtleType(
  pool: readonly WeightedTurtleType[],
  random: RandomSource,
): TurtleTypeDefinition {
  const total = totalWeightOf(pool);
  const threshold = nextUnitInterval(random) * total;

  let cumulative = 0;

  for (const entry of pool) {
    cumulative += entry.weight;

    if (entry.weight > 0 && threshold < cumulative) {
      return entry.definition;
    }
  }

  const lastPositive = [...pool].reverse().find((entry) => entry.weight > 0);

  if (lastPositive === undefined) {
    // Unreachable: totalWeightOf already guarantees a positive weight exists.
    throw new RangeError('Spawn pool must contain at least one entry with a positive weight');
  }

  return lastPositive.definition;
}

/* ------------------------------------------------------------------ *
 * Placement
 * ------------------------------------------------------------------ */

/**
 * The HUD bands, as rectangles nothing may spawn under.
 *
 * Kept here rather than in the scene so the reserved regions are described once,
 * in terms of the balance config, and can be tested.
 */
export function buildExclusionZones(area: PlayArea, config: SpawnBalance = BALANCE.spawn): Rect[] {
  const zones: Rect[] = [];

  if (config.hudSafeTopPx > 0) {
    zones.push({ x: 0, y: 0, width: area.width, height: config.hudSafeTopPx });
  }

  if (config.hudSafeBottomPx > 0) {
    zones.push({
      x: 0,
      y: area.height - config.hudSafeBottomPx,
      width: area.width,
      height: config.hudSafeBottomPx,
    });
  }

  return zones;
}

/**
 * Whether a circular target centred at (x, y) would overlap a rectangle.
 *
 * The rectangle is inflated by the target radius and tested against the centre
 * point. At the corners this is very slightly conservative — it treats the
 * target as square rather than round — which is the right way to err for a
 * keep-out zone.
 */
function overlapsRect(x: number, y: number, radius: number, rect: Rect): boolean {
  return (
    x >= rect.x - radius &&
    x <= rect.x + rect.width + radius &&
    y >= rect.y - radius &&
    y <= rect.y + rect.height + radius
  );
}

function isTooClose(
  x: number,
  y: number,
  existing: readonly SpawnPosition[],
  minSeparation: number,
): boolean {
  if (minSeparation <= 0) {
    return false;
  }

  const minSeparationSquared = minSeparation * minSeparation;

  return existing.some((position) => {
    const dx = position.x - x;
    const dy = position.y - y;

    return dx * dx + dy * dy < minSeparationSquared;
  });
}

/**
 * Find somewhere to put a new target.
 *
 * Rejection sampling with a hard attempt budget — it can never loop forever.
 *
 * CONTRACT: returns `null` when no valid position was found, rather than a
 * best-effort placement. A closest-available result would silently put a
 * turtle under the HUD or on top of another one, which is a gameplay bug that is
 * hard to spot; `null` makes the caller decide, and the obviously correct
 * decision for a spawner is to skip this tick and try again on the next one.
 * With at most three concurrent targets in a 960x540 area this is effectively
 * unreachable in normal play, so the skip costs nothing.
 *
 * Invalid *input* throws instead: a non-finite or non-positive area, or negative
 * radius/margin/separation, is a programming error and must not silently produce
 * NaN coordinates. A target simply too large for the area is a legitimate
 * runtime condition, so that returns `null`.
 */
export function findSpawnPosition(request: SpawnPlacementRequest): SpawnPosition | null {
  const {
    area,
    targetRadius,
    margin = BALANCE.spawn.marginPx,
    exclusionZones = [],
    existingPositions = [],
    minSeparation = BALANCE.spawn.minSeparationPx,
    maxAttempts = BALANCE.spawn.maxAttempts,
    random,
  } = request;

  requireFinite('area.width', area.width);
  requireFinite('area.height', area.height);

  if (area.width <= 0 || area.height <= 0) {
    throw new RangeError('Play area must have a positive width and height');
  }

  requireNonNegative('targetRadius', targetRadius);
  requireNonNegative('margin', margin);
  requireNonNegative('minSeparation', minSeparation);

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError(
      `maxAttempts must be an integer of at least 1 (received ${String(maxAttempts)})`,
    );
  }

  const inset = margin + targetRadius;
  const minX = inset;
  const maxX = area.width - inset;
  const minY = inset;
  const maxY = area.height - inset;

  // The target does not fit once margins are applied — a real runtime state, so
  // report it as "no position" rather than throwing.
  if (maxX < minX || maxY < minY) {
    return null;
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const x = minX + nextUnitInterval(random) * spanX;
    const y = minY + nextUnitInterval(random) * spanY;

    const blocked = exclusionZones.some((zone) => overlapsRect(x, y, targetRadius, zone));

    if (blocked) {
      continue;
    }

    if (isTooClose(x, y, existingPositions, minSeparation)) {
      continue;
    }

    return { x, y };
  }

  return null;
}
