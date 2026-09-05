import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import { TURTLE_TYPES, TURTLE_TYPES_BY_ID } from '../config/turtleTypes';
import { ensureTurtleTextures, turtleTextureKey } from '../entities/Turtle';
import { getStorageService } from '../services/StorageService';
import { createButton } from '../ui/Button';
import { FILL, FONT_STACK, TEXT } from '../ui/theme';

const GAME_SCENE_KEY = 'Game';

/**
 * The front screen: title, best score, one button into the round.
 *
 * Deliberately the shortest path into play. The legacy game asked for a
 * difficulty level and a round duration before anything happened; both are gone
 * as locked product decisions, so there is nothing to configure here. Settings
 * and How to Play are later work and are not stubbed out in advance.
 *
 * Still temporary: everything is drawn programmatically, with no image or audio
 * assets, until the art phase.
 */
export class MenuScene extends Phaser.Scene {
  public static readonly KEY = 'Menu';

  public constructor() {
    super(MenuScene.KEY);
  }

  public create(): void {
    ensureTurtleTextures(this, TURTLE_TYPES);

    const centerX = GAME_WIDTH / 2;

    this.createPlayfieldFrame();
    this.createTurtlePreview(centerX, 172);
    this.createTitle(centerX);
    this.createBestScore(centerX);

    createButton(this, {
      x: centerX,
      y: 392,
      label: 'PLAY',
      width: 240,
      height: 62,
      fontSize: 24,
      onPress: () => {
        this.scene.start(GAME_SCENE_KEY);
      },
    });

    this.createFooter(centerX);
  }

  /**
   * Outlines the 960x540 logical playfield. Because it is drawn at the logical
   * bounds, it makes any scaling or letterboxing problem immediately visible.
   */
  private createPlayfieldFrame(): void {
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - 24, GAME_HEIGHT - 24)
      .setStrokeStyle(2, FILL.shell);
  }

  /** Both variants, so the player recognises the gold one when it appears. */
  private createTurtlePreview(centerX: number, y: number): void {
    const normal = this.add.image(centerX - 78, y, turtleTextureKey(TURTLE_TYPES_BY_ID.normal));
    const golden = this.add
      .image(centerX + 78, y, turtleTextureKey(TURTLE_TYPES_BY_ID.golden))
      .setScale(0.78);

    this.tweens.add({
      targets: [normal, golden],
      y: '+=10',
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(
        centerX + 78,
        y + 62,
        `${TURTLE_TYPES_BY_ID.golden.label} · ${String(TURTLE_TYPES_BY_ID.golden.basePoints)} pts`,
        {
          fontFamily: FONT_STACK,
          fontSize: '13px',
          fontStyle: '700',
          color: TEXT.gold,
        },
      )
      .setOrigin(0.5);
  }

  private createTitle(centerX: number): void {
    this.add
      .text(centerX, 268, 'Catch the Turtle', {
        fontFamily: FONT_STACK,
        fontSize: '54px',
        fontStyle: '700',
        color: TEXT.primary,
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, 312, '60 SECONDS · CLICK OR TAP EVERY TURTLE YOU CAN', {
        fontFamily: FONT_STACK,
        fontSize: '15px',
        fontStyle: '600',
        color: TEXT.accent,
      })
      .setOrigin(0.5);
  }

  /**
   * The stored best. `StorageService` degrades to an in-memory value when
   * persistence is blocked, so this renders a real number either way and the
   * player is never shown a storage error they cannot act on.
   */
  private createBestScore(centerX: number): void {
    const highScore = getStorageService().getHighScore();

    this.add
      .text(centerX, 344, `BEST  ${highScore.toLocaleString('en-US')}`, {
        fontFamily: FONT_STACK,
        fontSize: '17px',
        fontStyle: '700',
        color: highScore > 0 ? TEXT.gold : TEXT.muted,
      })
      .setOrigin(0.5);
  }

  private createFooter(centerX: number): void {
    // Rendering the resolved base path makes a misconfigured GitHub Pages
    // deployment obvious on sight rather than only in the network tab.
    this.add
      .text(
        centerX,
        494,
        `Phaser ${Phaser.VERSION}  ·  ${String(GAME_WIDTH)}x${String(GAME_HEIGHT)} FIT  ·  base ${import.meta.env.BASE_URL}`,
        {
          fontFamily: FONT_STACK,
          fontSize: '13px',
          color: TEXT.faint,
        },
      )
      .setOrigin(0.5);
  }
}
