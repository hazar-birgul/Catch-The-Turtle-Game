import Phaser from 'phaser';

import { BALANCE } from '../config/balance';
import { GAME_WIDTH } from '../config/dimensions';
import { FILL, FONT_STACK, TEXT } from './theme';

/**
 * The in-round heads-up display.
 *
 * It renders numbers and nothing else: every value it shows is computed by the
 * pure gameplay systems and handed in through `update`. The HUD holds no round
 * state and applies no rules, which is what keeps `systems/scoring.ts` the single
 * definition of what a combo or an accuracy figure means.
 *
 * The whole thing is laid out inside `BALANCE.spawn.hudSafeTopPx`, which is the
 * same band `buildExclusionZones` keeps targets out of — so the HUD region and
 * the spawn keep-out region are one number, not two that can drift apart.
 */

/** Everything the HUD draws, in the form the scene already has it. */
export interface HudView {
  readonly score: number;
  readonly remainingSeconds: number;
  readonly combo: number;
  readonly multiplier: number;
  readonly accuracy: number;
  /** Used to tell "0% accuracy" apart from "no clicks yet". */
  readonly attempts: number;
}

const BAND_HEIGHT = BALANCE.spawn.hudSafeTopPx;

const LABEL_Y = 14;
const VALUE_Y = 32;

/** Left edge of each read-out. Values are left-aligned so they do not jitter. */
const COLUMN_X = {
  score: 32,
  time: 268,
  combo: 470,
  accuracy: 672,
} as const;

const PAUSE_BUTTON = { x: 908, y: BAND_HEIGHT / 2, width: 56, height: 42 } as const;

export class Hud {
  private readonly scoreValue: Phaser.GameObjects.Text;
  private readonly timeValue: Phaser.GameObjects.Text;
  private readonly comboLabel: Phaser.GameObjects.Text;
  private readonly comboValue: Phaser.GameObjects.Text;
  private readonly accuracyValue: Phaser.GameObjects.Text;

  public constructor(scene: Phaser.Scene, onPause: () => void) {
    scene.add.rectangle(0, 0, GAME_WIDTH, BAND_HEIGHT, FILL.band, 0.85).setOrigin(0, 0);
    scene.add.rectangle(0, BAND_HEIGHT, GAME_WIDTH, 2, FILL.shell).setOrigin(0, 0);

    this.addLabel(scene, COLUMN_X.score, 'SCORE');
    this.addLabel(scene, COLUMN_X.time, 'TIME');
    this.comboLabel = this.addLabel(scene, COLUMN_X.combo, 'COMBO');
    this.addLabel(scene, COLUMN_X.accuracy, 'ACCURACY');

    this.scoreValue = this.addValue(scene, COLUMN_X.score, '0');
    this.timeValue = this.addValue(scene, COLUMN_X.time, '0');
    this.comboValue = this.addValue(scene, COLUMN_X.combo, 'x1');
    this.accuracyValue = this.addValue(scene, COLUMN_X.accuracy, '—');

    this.createPauseButton(scene, onPause);
  }

  /** Redraw every read-out. Cheap enough to call once per frame. */
  public update(view: HudView): void {
    this.scoreValue.setText(view.score.toLocaleString('en-US'));
    this.timeValue.setText(String(view.remainingSeconds));

    this.comboValue.setText(`x${String(view.multiplier)}`);
    this.comboValue.setColor(view.multiplier > 1 ? TEXT.gold : TEXT.primary);
    // The streak sits in the label rather than getting a column of its own: it
    // is context for the multiplier, not a headline number.
    this.comboLabel.setText(view.combo > 0 ? `COMBO · ${String(view.combo)}` : 'COMBO');

    this.accuracyValue.setText(
      view.attempts === 0 ? '—' : `${String(Math.round(view.accuracy * 100))}%`,
    );
  }

  private addLabel(scene: Phaser.Scene, x: number, text: string): Phaser.GameObjects.Text {
    return scene.add.text(x, LABEL_Y, text, {
      fontFamily: FONT_STACK,
      fontSize: '12px',
      fontStyle: '700',
      color: TEXT.muted,
    });
  }

  private addValue(scene: Phaser.Scene, x: number, text: string): Phaser.GameObjects.Text {
    return scene.add.text(x, VALUE_Y, text, {
      fontFamily: FONT_STACK,
      fontSize: '26px',
      fontStyle: '700',
      color: TEXT.primary,
    });
  }

  /**
   * A visible pause control, so pausing is reachable on touch where there is no
   * Escape key. It is the only interactive object in the play area besides the
   * turtles; `GameScene` treats a press on any non-turtle interactive object as
   * interface input rather than as a missed swipe.
   */
  private createPauseButton(scene: Phaser.Scene, onPause: () => void): void {
    const background = scene.add
      .rectangle(
        PAUSE_BUTTON.x,
        PAUSE_BUTTON.y,
        PAUSE_BUTTON.width,
        PAUSE_BUTTON.height,
        FILL.panel,
      )
      .setStrokeStyle(2, FILL.shell)
      .setInteractive({ useHandCursor: true });

    scene.add
      .text(PAUSE_BUTTON.x, PAUSE_BUTTON.y, '❚❚', {
        fontFamily: FONT_STACK,
        fontSize: '16px',
        color: TEXT.muted,
      })
      .setOrigin(0.5);

    background.on('pointerover', () => background.setFillStyle(FILL.shell));
    background.on('pointerout', () => background.setFillStyle(FILL.panel));
    background.on('pointerdown', onPause);
  }
}
