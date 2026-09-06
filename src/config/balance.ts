/**
 * Gameplay balance — the single source of truth for every tuning value.
 *
 * No gameplay system may define a numeric constant of its own. If a number
 * influences how the game plays, it belongs here with a name that explains it.
 *
 * This is deliberately a plain typed constant, not a configuration framework:
 * the systems take their config as a parameter (defaulting to `BALANCE`), which
 * is all the flexibility tests and future tuning actually need.
 */

/** A value that ramps from its round-start value to its fully-ramped value. */
export interface RampedValue {
  readonly start: number;
  readonly end: number;
}

/**
 * One step of the combo multiplier staircase: from `minCombo` consecutive
 * catches onwards, hits are worth `multiplier` times their base points.
 */
export interface ComboTier {
  readonly minCombo: number;
  readonly multiplier: number;
}

export interface RoundBalance {
  readonly durationMs: number;
}

export interface ComboBalance {
  /** Ascending by `minCombo`; the last tier whose threshold is met wins. */
  readonly tiers: readonly ComboTier[];
}

export interface DifficultyBalance {
  /**
   * How long the round takes to reach maximum intensity. Deliberately shorter
   * than the round itself so the closing seconds are played at full difficulty
   * rather than still ramping up.
   */
  readonly rampDurationMs: number;
  /**
   * Shapes the ramp. 1 is linear; above 1 back-loads the difficulty so the
   * opening stays approachable and the pressure builds late.
   */
  readonly easingExponent: number;
  /** Milliseconds between spawns. Falls as the round progresses. */
  readonly spawnIntervalMs: RampedValue;
  /** How long a target stays on screen before escaping. Falls over the round. */
  readonly targetLifetimeMs: RampedValue;
  /** Target size multiplier. Falls over the round, so targets get smaller. */
  readonly targetScale: RampedValue;
  /** How many targets may be alive at once. Rises over the round. */
  readonly maxConcurrent: RampedValue;
}

export interface SpawnBalance {
  /**
   * Half a target's on-screen footprint at difficulty scale 1.
   *
   * One number drives three things that must never disagree: how large the
   * placeholder turtle is drawn, the radius placement keeps clear of edges and
   * neighbours, and the radius of the interactive hit area. Keeping them as one
   * number is what stops the sprite and the hitbox silently desynchronising.
   */
  readonly targetBaseRadiusPx: number;
  /**
   * How long the round waits before its first target appears, so the player can
   * read the HUD before the first spawn rather than reacting to it cold.
   */
  readonly firstSpawnDelayMs: number;
  /** Keep targets this far from the playfield edge, beyond their own radius. */
  readonly marginPx: number;
  /** Preferred centre-to-centre distance between two live targets. */
  readonly minSeparationPx: number;
  /** Rejection-sampling budget. Bounds the work; never loops forever. */
  readonly maxAttempts: number;
  /** Height of the HUD band at the top of the playfield; nothing spawns under it. */
  readonly hudSafeTopPx: number;
  /** Height of the reserved band at the bottom of the playfield. */
  readonly hudSafeBottomPx: number;
}

export interface AudioBalance {
  readonly defaultVolume: number;
  readonly defaultMuted: boolean;
}

export interface Balance {
  readonly round: RoundBalance;
  readonly combo: ComboBalance;
  readonly difficulty: DifficultyBalance;
  readonly spawn: SpawnBalance;
  readonly audio: AudioBalance;
}

export const BALANCE: Balance = {
  round: {
    // Locked product decision: one standard 60-second arcade round.
    durationMs: 60_000,
  },

  combo: {
    /*
     * A four-step staircase rather than a formula: a player can hold "I'm on x3"
     * in their head, and each step is a visible goal. Capping at x4 keeps a
     * perfect run worth roughly four times a sloppy one, which rewards skill
     * without letting one lucky streak make every earlier score irrelevant.
     */
    tiers: [
      { minCombo: 0, multiplier: 1 },
      { minCombo: 3, multiplier: 2 },
      { minCombo: 6, multiplier: 3 },
      { minCombo: 10, multiplier: 4 },
    ],
  },

  difficulty: {
    rampDurationMs: 45_000,
    easingExponent: 1.4,
    spawnIntervalMs: { start: 1400, end: 480 },
    targetLifetimeMs: { start: 2200, end: 950 },
    targetScale: { start: 1, end: 0.7 },
    maxConcurrent: { start: 1, end: 3 },
  },

  spawn: {
    targetBaseRadiusPx: 46,
    firstSpawnDelayMs: 400,
    marginPx: 28,
    minSeparationPx: 96,
    maxAttempts: 24,
    hudSafeTopPx: 76,
    hudSafeBottomPx: 16,
  },

  audio: {
    defaultVolume: 0.8,
    defaultMuted: false,
  },
};

/**
 * Development-time sanity check for a balance configuration.
 *
 * Returns a list of human-readable problems; an empty list means the config is
 * coherent. This is a small helper deliberately kept out of the runtime hot
 * path — it exists so the test suite can assert that hand-tuned numbers stay
 * internally consistent as they are adjusted.
 */
export function validateBalance(balance: Balance = BALANCE): string[] {
  const problems: string[] = [];

  const requirePositive = (label: string, value: number): void => {
    if (!Number.isFinite(value) || value <= 0) {
      problems.push(`${label} must be a positive finite number (received ${String(value)})`);
    }
  };

  requirePositive('round.durationMs', balance.round.durationMs);
  requirePositive('difficulty.rampDurationMs', balance.difficulty.rampDurationMs);
  requirePositive('difficulty.easingExponent', balance.difficulty.easingExponent);
  requirePositive('spawn.maxAttempts', balance.spawn.maxAttempts);
  requirePositive('spawn.targetBaseRadiusPx', balance.spawn.targetBaseRadiusPx);
  requirePositive('audio.defaultVolume', balance.audio.defaultVolume);

  const { spawnIntervalMs, targetLifetimeMs, targetScale, maxConcurrent } = balance.difficulty;

  requirePositive('difficulty.spawnIntervalMs.start', spawnIntervalMs.start);
  requirePositive('difficulty.spawnIntervalMs.end', spawnIntervalMs.end);
  requirePositive('difficulty.targetLifetimeMs.start', targetLifetimeMs.start);
  requirePositive('difficulty.targetLifetimeMs.end', targetLifetimeMs.end);
  requirePositive('difficulty.targetScale.start', targetScale.start);
  requirePositive('difficulty.targetScale.end', targetScale.end);
  requirePositive('difficulty.maxConcurrent.start', maxConcurrent.start);
  requirePositive('difficulty.maxConcurrent.end', maxConcurrent.end);

  // The round must get harder, not easier.
  if (spawnIntervalMs.end > spawnIntervalMs.start) {
    problems.push('difficulty.spawnIntervalMs must not increase over the round');
  }
  if (targetLifetimeMs.end > targetLifetimeMs.start) {
    problems.push('difficulty.targetLifetimeMs must not increase over the round');
  }
  if (targetScale.end > targetScale.start) {
    problems.push('difficulty.targetScale must not increase over the round');
  }
  if (maxConcurrent.end < maxConcurrent.start) {
    problems.push('difficulty.maxConcurrent must not decrease over the round');
  }

  if (balance.spawn.marginPx < 0) {
    problems.push('spawn.marginPx must not be negative');
  }
  if (!Number.isFinite(balance.spawn.firstSpawnDelayMs) || balance.spawn.firstSpawnDelayMs < 0) {
    problems.push('spawn.firstSpawnDelayMs must be a non-negative finite number');
  }
  if (balance.spawn.minSeparationPx < 0) {
    problems.push('spawn.minSeparationPx must not be negative');
  }
  if (balance.spawn.hudSafeTopPx < 0 || balance.spawn.hudSafeBottomPx < 0) {
    problems.push('spawn HUD safe bands must not be negative');
  }

  const { tiers } = balance.combo;
  if (tiers.length === 0) {
    problems.push('combo.tiers must not be empty');
  }
  if (tiers[0]?.minCombo !== 0) {
    problems.push('combo.tiers must start at minCombo 0 so every combo has a multiplier');
  }
  tiers.forEach((tier, index) => {
    if (tier.multiplier <= 0 || !Number.isFinite(tier.multiplier)) {
      problems.push(`combo.tiers[${String(index)}].multiplier must be positive and finite`);
    }
    const previous = tiers[index - 1];
    if (previous !== undefined) {
      if (tier.minCombo <= previous.minCombo) {
        problems.push('combo.tiers must be sorted by ascending minCombo');
      }
      if (tier.multiplier < previous.multiplier) {
        problems.push('combo.tiers multipliers must not decrease as the combo grows');
      }
    }
  });

  if (balance.audio.defaultVolume < 0 || balance.audio.defaultVolume > 1) {
    problems.push('audio.defaultVolume must be within 0..1');
  }

  return problems;
}
