import Phaser from 'phaser';

import { GAME_WIDTH } from '../config/dimensions';
import { FEEL } from '../config/feel';
import { TURTLE_TYPES_BY_ID } from '../config/turtleTypes';
import type { RoundResult } from '../systems/scoring';
import { getStorageService } from '../services/StorageService';
import { createButton } from '../ui/Button';
import { createText, FILL, TEXT } from '../ui/theme';
import { applyLogicalViewport } from '../ui/viewport';

/**
 * The end-of-round summary.
 *
 * The result arrives as a typed scene payload rather than a module-level global,
 * so it is explicit at the boundary and cannot be read by a scene that was never
 * handed it.
 */

export interface GameOverPayload {
  readonly result: RoundResult;
}

const GAME_SCENE_KEY = 'Game';
const MENU_SCENE_KEY = 'Menu';

/** One headline statistic: label, formatted value, and how to colour it. */
interface SummaryStat {
  readonly label: string;
  readonly value: string;
  readonly color: string;
}

export class GameOverScene extends Phaser.Scene {
  public static readonly KEY = 'GameOver';

  private result: RoundResult | null = null;

  public constructor() {
    super(GameOverScene.KEY);
  }

  public init(data: Partial<GameOverPayload>): void {
    this.result = data.result ?? null;
  }

  public create(): void {
    const result = this.result;

    if (result === null) {
      // Reached only if something starts this scene without a round behind it.
      // Bouncing to the menu beats rendering a screen full of zeroes.
      this.scene.start(MENU_SCENE_KEY);

      return;
    }

    // Submitting here keeps the round scene free of persistence concerns, and
    // `StorageService` owns the "is it a new best?" comparison.
    const { highScore, isNewBest } = getStorageService().submitScore(result.score);

    applyLogicalViewport(this);

    this.cameras.main.setBackgroundColor(FILL.background);

    const centerX = GAME_WIDTH / 2;

    this.createScoreBlock(centerX, result, highScore, isNewBest);
    this.createBreakdown(centerX, result);

    createButton(this, {
      x: centerX - 128,
      y: 462,
      label: 'PLAY AGAIN',
      onPress: () => {
        this.scene.start(GAME_SCENE_KEY);
      },
    });

    createButton(this, {
      x: centerX + 128,
      y: 462,
      label: 'MAIN MENU',
      variant: 'secondary',
      onPress: () => {
        this.scene.start(MENU_SCENE_KEY);
      },
    });
  }

  /** The score carries the size and the accent; the title only names the screen. */
  private createScoreBlock(
    centerX: number,
    result: RoundResult,
    highScore: number,
    isNewBest: boolean,
  ): void {
    createText(this, centerX, 64, "TIME'S UP", {
      fontSize: 20,
      color: TEXT.secondary,
      letterSpacing: 8,
    }).setOrigin(0.5);

    createText(this, centerX, 148, result.score.toLocaleString('en-US'), {
      fontSize: 92,
      color: TEXT.accent,
    }).setOrigin(0.5);

    const bestLine = createText(
      this,
      centerX,
      212,
      isNewBest ? 'NEW BEST' : `BEST  ${highScore.toLocaleString('en-US')}`,
      {
        fontSize: isNewBest ? 16 : 13,
        color: isNewBest ? TEXT.amber : TEXT.muted,
        letterSpacing: 4,
      },
    ).setOrigin(0.5);

    if (!isNewBest) {
      return;
    }

    bestLine.setScale(FEEL.newBest.fromScale);

    this.tweens.add({
      targets: bestLine,
      scale: 1,
      duration: FEEL.newBest.introMs,
      ease: 'Back.easeOut',
    });

    this.tweens.add({
      targets: bestLine,
      alpha: 0.55,
      delay: FEEL.newBest.introMs,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * The per-stat breakdown, laid out as evenly spaced columns so a future stat
   * needs an entry in this list and nothing else.
   */
  private createBreakdown(centerX: number, result: RoundResult): void {
    const golden = TURTLE_TYPES_BY_ID.golden;

    const stats: readonly SummaryStat[] = [
      {
        label: 'ACCURACY',
        value: result.attempts === 0 ? '—' : `${String(Math.round(result.accuracy * 100))}%`,
        color: TEXT.primary,
      },
      { label: 'MAX COMBO', value: `x${String(result.maxCombo)}`, color: TEXT.primary },
      { label: 'CAUGHT', value: String(result.hits), color: TEXT.primary },
      // Amber here matches the colour the player saw the target in.
      {
        label: golden.label.toUpperCase(),
        value: String(result.caughtByType.golden),
        color: TEXT.amber,
      },
    ];

    const spacing = 186;
    const startX = centerX - (spacing * (stats.length - 1)) / 2;

    stats.forEach((stat, index) => {
      const x = startX + spacing * index;

      createText(this, x, 290, stat.label, {
        fontSize: 11,
        color: TEXT.muted,
        letterSpacing: 2,
      }).setOrigin(0.5);

      createText(this, x, 322, stat.value, { fontSize: 32, color: stat.color }).setOrigin(0.5);
    });

    this.add.rectangle(centerX, 364, 560, 1, FILL.border);

    createText(
      this,
      centerX,
      390,
      `Misses ${String(result.misses)}   ·   Escaped ${String(result.escaped)}   ·   Spawned ${String(result.spawned)}`,
      { fontSize: 13, color: TEXT.muted, weight: '600' },
    ).setOrigin(0.5);
  }
}
