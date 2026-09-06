import Phaser from 'phaser';

import { BALANCE } from '../config/balance';
import { GAME_WIDTH } from '../config/dimensions';
import { FEEL } from '../config/feel';
import { createText, FILL, TEXT } from './theme';

/**
 * The in-round heads-up display. It renders values handed in through `update` and
 * holds no round state of its own.
 *
 * Its height is `BALANCE.spawn.hudSafeTopPx`, the same band `buildExclusionZones`
 * keeps targets out of — one number, not two that can drift apart. The layout
 * must stay inside it rather than claim play space.
 */

/** What the HUD's own controls report back to the round. */
export interface HudControls {
  readonly onPause: () => void;
  readonly onToggleMute: () => boolean;
  readonly initiallyMuted: boolean;
}

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

/**
 * Labels sit on a quiet baseline above their value, so the eye reads down a
 * column rather than across a row of equally weighted text.
 */
const LABEL_Y = 24;
const VALUE_Y = 50;

/** Left edge of each read-out. Values are left-aligned so they do not jitter. */
const COLUMN_X = {
  score: 32,
  time: 268,
  combo: 470,
  accuracy: 672,
} as const;

const PAUSE_BUTTON = { x: 906, y: BAND_HEIGHT / 2, width: 52, height: 40 } as const;
const MUTE_BUTTON = { x: 838, y: BAND_HEIGHT / 2, width: 60, height: 40 } as const;

/** Below this, the countdown turns amber. Presentation only — see `update`. */
const URGENT_SECONDS = 10;

export class Hud {
  private readonly scoreValue: Phaser.GameObjects.Text;
  private readonly timeValue: Phaser.GameObjects.Text;
  private readonly comboLabel: Phaser.GameObjects.Text;
  private readonly comboValue: Phaser.GameObjects.Text;
  private readonly accuracyValue: Phaser.GameObjects.Text;

  private muteLabel!: Phaser.GameObjects.Text;

  private readonly scene: Phaser.Scene;

  public constructor(scene: Phaser.Scene, controls: HudControls) {
    this.scene = scene;
    scene.add.rectangle(0, 0, GAME_WIDTH, BAND_HEIGHT, FILL.surface).setOrigin(0, 0);
    scene.add.rectangle(0, BAND_HEIGHT - 1, GAME_WIDTH, 1, FILL.border).setOrigin(0, 0);

    this.addLabel(scene, COLUMN_X.score, 'SCORE');
    this.addLabel(scene, COLUMN_X.time, 'TIME');
    this.comboLabel = this.addLabel(scene, COLUMN_X.combo, 'COMBO');
    this.addLabel(scene, COLUMN_X.accuracy, 'ACCURACY');

    this.scoreValue = this.addValue(scene, COLUMN_X.score, '0', TEXT.accent);
    this.timeValue = this.addValue(scene, COLUMN_X.time, '0');
    this.comboValue = this.addValue(scene, COLUMN_X.combo, 'x1');
    this.accuracyValue = this.addValue(scene, COLUMN_X.accuracy, '—');

    this.createPauseButton(scene, controls.onPause);
    this.createMuteButton(scene, controls);
  }

  /** Emphasise the multiplier. Called only when the combo tier actually changes. */
  public punchCombo(): void {
    this.scene.tweens.killTweensOf(this.comboValue);
    this.comboValue.setScale(1);

    this.scene.tweens.add({
      targets: this.comboValue,
      scale: FEEL.combo.punchScale,
      duration: FEEL.combo.punchMs / 2,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  /** A single beat on the clock, driven by the round's authoritative second. */
  public pulseTime(): void {
    this.scene.tweens.killTweensOf(this.timeValue);
    this.timeValue.setScale(1);

    this.scene.tweens.add({
      targets: this.timeValue,
      scale: 1.22,
      duration: FEEL.countdown.pulseMs / 2,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  public setMuted(muted: boolean): void {
    this.muteLabel.setText(muted ? 'SFX OFF' : 'SFX ON');
    this.muteLabel.setColor(muted ? TEXT.muted : TEXT.accent);
  }

  /** Redraw every read-out. Cheap enough to call once per frame. */
  public update(view: HudView): void {
    this.scoreValue.setText(view.score.toLocaleString('en-US'));

    this.timeValue.setText(String(view.remainingSeconds));
    // Presentation only: the round is driven entirely by `GameScene.elapsedMs`.
    this.timeValue.setColor(view.remainingSeconds <= URGENT_SECONDS ? TEXT.amber : TEXT.primary);

    this.comboValue.setText(`x${String(view.multiplier)}`);
    this.comboValue.setColor(view.multiplier > 1 ? TEXT.amber : TEXT.primary);
    // The streak sits in the label rather than getting a column of its own: it
    // is context for the multiplier, not a headline number.
    this.comboLabel.setText(view.combo > 0 ? `COMBO · ${String(view.combo)}` : 'COMBO');

    this.accuracyValue.setText(
      view.attempts === 0 ? '—' : `${String(Math.round(view.accuracy * 100))}%`,
    );
  }

  private addLabel(scene: Phaser.Scene, x: number, text: string): Phaser.GameObjects.Text {
    return createText(scene, x, LABEL_Y, text, {
      fontSize: 11,
      color: TEXT.muted,
      letterSpacing: 2,
    }).setOrigin(0, 0.5);
  }

  private addValue(
    scene: Phaser.Scene,
    x: number,
    text: string,
    color: string = TEXT.primary,
  ): Phaser.GameObjects.Text {
    return createText(scene, x, VALUE_Y, text, { fontSize: 26, color }).setOrigin(0, 0.5);
  }

  /**
   * Pausing has to be reachable on touch, where there is no Escape key. This is
   * the only interactive object in the play area besides the turtles, which is
   * what lets `GameScene` treat any non-turtle hit as interface input.
   */
  private createPauseButton(scene: Phaser.Scene, onPause: () => void): void {
    const background = scene.add
      .rectangle(
        PAUSE_BUTTON.x,
        PAUSE_BUTTON.y,
        PAUSE_BUTTON.width,
        PAUSE_BUTTON.height,
        0x000000,
        0,
      )
      .setStrokeStyle(1, FILL.border)
      .setInteractive({ useHandCursor: true });

    const glyph = createText(scene, PAUSE_BUTTON.x, PAUSE_BUTTON.y, '❚❚', {
      fontSize: 14,
      color: TEXT.secondary,
    }).setOrigin(0.5);

    background.on('pointerover', () => {
      background.setStrokeStyle(1, FILL.accent);
      glyph.setColor(TEXT.accent);
    });
    background.on('pointerout', () => {
      background.setStrokeStyle(1, FILL.border);
      glyph.setColor(TEXT.secondary);
    });
    background.on('pointerdown', onPause);
  }

  private createMuteButton(scene: Phaser.Scene, controls: HudControls): void {
    const background = scene.add
      .rectangle(MUTE_BUTTON.x, MUTE_BUTTON.y, MUTE_BUTTON.width, MUTE_BUTTON.height, 0x000000, 0)
      .setStrokeStyle(1, FILL.border)
      .setInteractive({ useHandCursor: true });

    const label = createText(scene, MUTE_BUTTON.x, MUTE_BUTTON.y, 'SFX ON', {
      fontSize: 10,
      color: TEXT.accent,
      letterSpacing: 1,
    }).setOrigin(0.5);

    background.on('pointerover', () => {
      background.setStrokeStyle(1, FILL.accent);
    });
    background.on('pointerout', () => {
      background.setStrokeStyle(1, FILL.border);
    });
    background.on('pointerdown', () => {
      this.setMuted(controls.onToggleMute());
    });

    this.muteLabel = label;
    this.setMuted(controls.initiallyMuted);
  }
}
