import { describe, expect, it } from 'vitest';

import { BALANCE } from './balance';
import { countdownCueAt, FEEL, validateFeel, type Feel } from './feel';

function withCountdown(urgentSeconds: number, finalSeconds: number): Feel {
  return { ...FEEL, countdown: { ...FEEL.countdown, urgentSeconds, finalSeconds } };
}

describe('validateFeel', () => {
  it('accepts the shipped configuration', () => {
    expect(validateFeel()).toEqual([]);
  });

  it('rejects a non-positive duration', () => {
    const broken: Feel = { ...FEEL, spawn: { ...FEEL.spawn, durationMs: 0 } };

    expect(validateFeel(broken)).toContain('spawn.durationMs must be a positive finite number');
  });

  it('rejects a spawn scale that is not smaller than the target size', () => {
    const broken: Feel = { ...FEEL, spawn: { ...FEEL.spawn, fromScale: 1 } };

    expect(validateFeel(broken)).toContain('spawn.fromScale must be between 0 and 1 exclusive');
  });

  it('rejects a catch punch that does not overshoot', () => {
    const broken: Feel = { ...FEEL, catch: { ...FEEL.catch, punchScale: 1 } };

    expect(validateFeel(broken)).toContain('catch.punchScale must exceed 1 to read as a punch');
  });

  it('requires the Golden burst to be larger than the Normal one', () => {
    const broken: Feel = {
      ...FEEL,
      particles: { ...FEEL.particles, goldenCount: FEEL.particles.normalCount },
    };

    expect(validateFeel(broken)).toContain(
      'particles.goldenCount must exceed particles.normalCount',
    );
  });

  it('requires the final countdown step to sit inside the urgent one', () => {
    expect(validateFeel(withCountdown(5, 10))).toContain(
      'countdown.finalSeconds must be below countdown.urgentSeconds',
    );
  });

  it('rejects a miss-marker cap that is not a positive integer', () => {
    const broken: Feel = { ...FEEL, miss: { ...FEEL.miss, maxMarkers: 0 } };

    expect(validateFeel(broken)).toContain('miss.maxMarkers must be an integer of at least 1');
  });

  it('keeps the end-of-round hold short enough that replay stays immediate', () => {
    const broken: Feel = { ...FEEL, roundEnd: { ...FEEL.roundEnd, holdMs: 2000 } };

    expect(validateFeel(broken)).toContain(
      'roundEnd.holdMs must stay under a second so replay feels immediate',
    );
  });
});

describe('countdownCueAt', () => {
  it('stays silent for most of the round', () => {
    expect(countdownCueAt(60)).toBeNull();
    expect(countdownCueAt(30)).toBeNull();
    expect(countdownCueAt(11)).toBeNull();
  });

  it('ticks softly through the urgent window', () => {
    expect(countdownCueAt(10)).toBe('soft');
    expect(countdownCueAt(6)).toBe('soft');
  });

  it('escalates for the final seconds', () => {
    expect(countdownCueAt(5)).toBe('final');
    expect(countdownCueAt(1)).toBe('final');
  });

  it('is silent once the clock has run out, so it cannot overlap the round-over cue', () => {
    expect(countdownCueAt(0)).toBeNull();
    expect(countdownCueAt(-1)).toBeNull();
  });

  it('is silent for a non-finite clock rather than cueing every frame', () => {
    expect(countdownCueAt(Number.NaN)).toBeNull();
    expect(countdownCueAt(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('honours a custom window', () => {
    const feel = withCountdown(4, 2).countdown;

    expect(countdownCueAt(5, feel)).toBeNull();
    expect(countdownCueAt(4, feel)).toBe('soft');
    expect(countdownCueAt(2, feel)).toBe('final');
  });

  it('produces exactly one cue per second of the round, and none before the window', () => {
    const totalSeconds = BALANCE.round.durationMs / 1000;
    const cues: string[] = [];

    for (let remaining = totalSeconds; remaining >= 1; remaining -= 1) {
      const cue = countdownCueAt(remaining);

      if (cue !== null) {
        cues.push(cue);
      }
    }

    expect(cues).toEqual([
      'soft',
      'soft',
      'soft',
      'soft',
      'soft',
      'final',
      'final',
      'final',
      'final',
      'final',
    ]);
  });
});
