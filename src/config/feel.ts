/**
 * Presentation timing: animation, feedback and audio cueing.
 *
 * Strictly separate from `balance.ts`, which owns gameplay. A value belongs here
 * only if changing it cannot change the outcome of a round — a spawn tween's
 * duration does, a target's lifetime does not.
 */

export interface SpawnFeel {
  readonly durationMs: number;
  readonly fromScale: number;
  readonly fromAlpha: number;
}

export interface CatchFeel {
  /** Quick overshoot before the target collapses. */
  readonly punchMs: number;
  readonly punchScale: number;
  readonly collapseMs: number;
  readonly collapseScale: number;
}

export interface EscapeFeel {
  readonly durationMs: number;
  readonly toScale: number;
  /** Dimmed rather than brightened, so it never reads as a reward. */
  readonly dimAlpha: number;
}

export interface FloatingScoreFeel {
  readonly durationMs: number;
  readonly riseDistancePx: number;
  readonly fontSize: number;
  readonly goldenFontSize: number;
}

export interface ComboFeel {
  readonly punchMs: number;
  readonly punchScale: number;
  readonly bannerMs: number;
  readonly breakMs: number;
  /** Below this multiplier a broken combo is not worth announcing. */
  readonly breakAnnounceMultiplier: number;
}

export interface MissFeel {
  readonly durationMs: number;
  readonly radiusPx: number;
  /** Hard cap on simultaneous markers, so rapid clicking cannot flood the scene. */
  readonly maxMarkers: number;
}

export interface ParticleFeel {
  readonly lifespanMs: number;
  readonly normalCount: number;
  readonly goldenCount: number;
  readonly speedMin: number;
  readonly speedMax: number;
  readonly sizePx: number;
}

export interface CountdownFeel {
  /** Remaining seconds at which the clock starts reading as urgent. */
  readonly urgentSeconds: number;
  /** Remaining seconds at which the emphasis steps up again. */
  readonly finalSeconds: number;
  readonly pulseMs: number;
}

export interface RoundEndFeel {
  /** How long "TIME'S UP" holds before the summary. Kept short so replay is quick. */
  readonly holdMs: number;
  readonly bannerFadeMs: number;
}

export interface GoldenFeel {
  readonly pulseMs: number;
  readonly pulseScale: number;
  readonly haloAlpha: number;
}

export interface NewBestFeel {
  readonly introMs: number;
  readonly fromScale: number;
}

export interface Feel {
  readonly spawn: SpawnFeel;
  readonly catch: CatchFeel;
  readonly escape: EscapeFeel;
  readonly floatingScore: FloatingScoreFeel;
  readonly combo: ComboFeel;
  readonly miss: MissFeel;
  readonly particles: ParticleFeel;
  readonly countdown: CountdownFeel;
  readonly roundEnd: RoundEndFeel;
  readonly golden: GoldenFeel;
  readonly newBest: NewBestFeel;
}

export const FEEL: Feel = {
  spawn: {
    durationMs: 170,
    fromScale: 0.7,
    fromAlpha: 0.35,
  },
  catch: {
    punchMs: 70,
    punchScale: 1.25,
    collapseMs: 130,
    collapseScale: 0.1,
  },
  escape: {
    durationMs: 200,
    toScale: 0.72,
    dimAlpha: 0,
  },
  floatingScore: {
    durationMs: 620,
    riseDistancePx: 48,
    fontSize: 22,
    goldenFontSize: 30,
  },
  combo: {
    punchMs: 220,
    punchScale: 1.55,
    bannerMs: 640,
    breakMs: 480,
    breakAnnounceMultiplier: 2,
  },
  miss: {
    durationMs: 320,
    radiusPx: 26,
    maxMarkers: 6,
  },
  particles: {
    lifespanMs: 380,
    normalCount: 8,
    goldenCount: 16,
    speedMin: 60,
    speedMax: 190,
    sizePx: 6,
  },
  countdown: {
    urgentSeconds: 10,
    finalSeconds: 5,
    pulseMs: 260,
  },
  roundEnd: {
    holdMs: 420,
    bannerFadeMs: 160,
  },
  golden: {
    pulseMs: 900,
    pulseScale: 1.06,
    haloAlpha: 0.22,
  },
  newBest: {
    introMs: 340,
    fromScale: 0.7,
  },
};

/** Which countdown tick, if any, belongs to a given second of the clock. */
export type CountdownCue = 'soft' | 'final' | null;

/**
 * The closing seconds escalate in two steps rather than ticking all the way from
 * 10, which would be more irritating than tense.
 */
export function countdownCueAt(
  remainingSeconds: number,
  feel: CountdownFeel = FEEL.countdown,
): CountdownCue {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) {
    return null;
  }

  if (remainingSeconds <= feel.finalSeconds) {
    return 'final';
  }

  return remainingSeconds <= feel.urgentSeconds ? 'soft' : null;
}

/** Human-readable problems with a feel config; empty means coherent. */
export function validateFeel(feel: Feel = FEEL): string[] {
  const problems: string[] = [];

  const durations: readonly (readonly [string, number])[] = [
    ['spawn.durationMs', feel.spawn.durationMs],
    ['catch.punchMs', feel.catch.punchMs],
    ['catch.collapseMs', feel.catch.collapseMs],
    ['escape.durationMs', feel.escape.durationMs],
    ['floatingScore.durationMs', feel.floatingScore.durationMs],
    ['combo.punchMs', feel.combo.punchMs],
    ['combo.bannerMs', feel.combo.bannerMs],
    ['combo.breakMs', feel.combo.breakMs],
    ['miss.durationMs', feel.miss.durationMs],
    ['particles.lifespanMs', feel.particles.lifespanMs],
    ['countdown.pulseMs', feel.countdown.pulseMs],
    ['roundEnd.holdMs', feel.roundEnd.holdMs],
    ['golden.pulseMs', feel.golden.pulseMs],
    ['newBest.introMs', feel.newBest.introMs],
  ];

  for (const [name, value] of durations) {
    if (!Number.isFinite(value) || value <= 0) {
      problems.push(`${name} must be a positive finite number`);
    }
  }

  if (feel.spawn.fromScale <= 0 || feel.spawn.fromScale >= 1) {
    problems.push('spawn.fromScale must be between 0 and 1 exclusive');
  }
  if (feel.spawn.fromAlpha < 0 || feel.spawn.fromAlpha > 1) {
    problems.push('spawn.fromAlpha must be within 0..1');
  }
  if (feel.catch.punchScale <= 1) {
    problems.push('catch.punchScale must exceed 1 to read as a punch');
  }
  if (feel.combo.punchScale <= 1) {
    problems.push('combo.punchScale must exceed 1 to read as a punch');
  }
  if (feel.miss.maxMarkers < 1 || !Number.isInteger(feel.miss.maxMarkers)) {
    problems.push('miss.maxMarkers must be an integer of at least 1');
  }
  if (feel.particles.normalCount < 1 || feel.particles.goldenCount < 1) {
    problems.push('particle counts must be at least 1');
  }
  if (feel.particles.goldenCount <= feel.particles.normalCount) {
    problems.push('particles.goldenCount must exceed particles.normalCount');
  }
  if (feel.particles.speedMin >= feel.particles.speedMax) {
    problems.push('particles.speedMin must be below particles.speedMax');
  }
  if (feel.countdown.finalSeconds >= feel.countdown.urgentSeconds) {
    problems.push('countdown.finalSeconds must be below countdown.urgentSeconds');
  }
  if (feel.roundEnd.holdMs > 1000) {
    problems.push('roundEnd.holdMs must stay under a second so replay feels immediate');
  }

  return problems;
}
