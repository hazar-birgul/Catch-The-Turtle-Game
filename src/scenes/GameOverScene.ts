import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '../config/dimensions';
import { TURTLE_TYPES_BY_ID } from '../config/turtleTypes';
import type { RoundResult } from '../systems/scoring';
import { getStorageService } from '../services/StorageService';
import { createButton } from '../ui/Button';
import { FILL, FONT_STACK, TEXT } from '../ui/theme';

/**
 * The end-of-round summary.
 *
 * The result arrives as a typed scene payload rather than through a module-level
 * global — the legacy game kept its state in Python globals and it is exactly
 * what this rebuild exists to avoid. Phaser scene data is explicit, typed at the
 * boundary, and cannot be read by a scene that was never handed it.
 */

export interface GameOverPayload {
  readonly result: RoundResult;
}

const GAME_SCENE_KEY = 'Game';
const MENU_SCENE_KEY = 'Menu';

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

    // Submitting here, rather than in GameScene, keeps the round scene free of
    // persistence concerns — and `StorageService` owns the "is it a new best?"
    // comparison, so this screen never re-derives it.
    const { highScore, isNewBest } = getStorageService().submitScore(result.score);

    this.cameras.main.setBackgroundColor(FILL.background);

    const centerX = GAME_WIDTH / 2;

    this.add
      .text(centerX, 52, "TIME'S UP", {
        fontFamily: FONT_STACK,
        fontSize: '42px',
        fontStyle: '700',
        color: TEXT.primary,
      })
      .setOrigin(0.5, 0);

    this.createScoreBlock(centerX, result, highScore, isNewBest);
    this.createBreakdown(centerX, result);

    createButton(this, {
      x: centerX - 124,
      y: GAME_HEIGHT - 66,
      label: 'PLAY AGAIN',
      onPress: () => {
        this.scene.start(GAME_SCENE_KEY);
      },
    });

    createButton(this, {
      x: centerX + 124,
      y: GAME_HEIGHT - 66,
      label: 'MAIN MENU',
      variant: 'secondary',
      onPress: () => {
        this.scene.start(MENU_SCENE_KEY);
      },
    });
  }

  private createScoreBlock(
    centerX: number,
    result: RoundResult,
    highScore: number,
    isNewBest: boolean,
  ): void {
    this.add
      .text(centerX, 112, result.score.toLocaleString('en-US'), {
        fontFamily: FONT_STACK,
        fontSize: '78px',
        fontStyle: '700',
        color: TEXT.accent,
      })
      .setOrigin(0.5, 0);

    const bestLine = isNewBest ? 'NEW BEST!' : `BEST  ${highScore.toLocaleString('en-US')}`;

    this.add
      .text(centerX, 202, bestLine, {
        fontFamily: FONT_STACK,
        fontSize: '20px',
        fontStyle: '700',
        color: isNewBest ? TEXT.gold : TEXT.muted,
      })
      .setOrigin(0.5, 0);
  }

  /**
   * The per-stat breakdown, laid out as evenly spaced columns so a future stat
   * needs an entry in this list and nothing else.
   */
  private createBreakdown(centerX: number, result: RoundResult): void {
    const stats: readonly (readonly [string, string])[] = [
      ['ACCURACY', result.attempts === 0 ? '—' : `${String(Math.round(result.accuracy * 100))}%`],
      ['MAX COMBO', `x${String(result.maxCombo)}`],
      ['CAUGHT', String(result.hits)],
      [
        `${TURTLE_TYPES_BY_ID.golden.label.toUpperCase()} CAUGHT`,
        String(result.caughtByType.golden),
      ],
    ];

    const spacing = 208;
    const startX = centerX - (spacing * (stats.length - 1)) / 2;

    stats.forEach(([label, value], index) => {
      const x = startX + spacing * index;

      this.add
        .text(x, 274, label, {
          fontFamily: FONT_STACK,
          fontSize: '12px',
          fontStyle: '700',
          color: TEXT.muted,
        })
        .setOrigin(0.5, 0);

      this.add
        .text(x, 294, value, {
          fontFamily: FONT_STACK,
          fontSize: '30px',
          fontStyle: '700',
          color: TEXT.primary,
        })
        .setOrigin(0.5, 0);
    });

    this.add
      .text(
        centerX,
        362,
        `Misses ${String(result.misses)}   ·   Escaped ${String(result.escaped)}   ·   Spawned ${String(result.spawned)}`,
        {
          fontFamily: FONT_STACK,
          fontSize: '15px',
          color: TEXT.faint,
        },
      )
      .setOrigin(0.5, 0);
  }
}
