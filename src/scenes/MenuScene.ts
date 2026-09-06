import Phaser from 'phaser';

import { GAME_WIDTH } from '../config/dimensions';
import { TURTLE_TYPES, TURTLE_TYPES_BY_ID, type TurtleTypeDefinition } from '../config/turtleTypes';
import { createTurtleImage, ensureTurtleTextures } from '../entities/Turtle';
import { getAudioService } from '../services/AudioService';
import { getStorageService } from '../services/StorageService';
import { createButton } from '../ui/Button';
import { createText, FILL, TEXT } from '../ui/theme';
import { applyLogicalViewport } from '../ui/viewport';

const GAME_SCENE_KEY = 'Game';

/**
 * The front screen: what the game is, what the two targets are worth, and one
 * button into the round. There is deliberately nothing to configure.
 */
export class MenuScene extends Phaser.Scene {
  public static readonly KEY = 'Menu';

  public constructor() {
    super(MenuScene.KEY);
  }

  public create(): void {
    applyLogicalViewport(this);

    ensureTurtleTextures(this, TURTLE_TYPES);

    this.cameras.main.setBackgroundColor(FILL.background);

    // Phaser unlocks the audio context on the first input gesture, which is the
    // Play button; attaching here just re-applies the persisted mute and volume.
    getAudioService().attach(this.sound);

    const centerX = GAME_WIDTH / 2;

    this.createMasthead(centerX);
    this.createTurtleLegend(centerX);

    createButton(this, {
      x: centerX,
      y: 380,
      label: 'PLAY',
      width: 260,
      height: 60,
      fontSize: 20,
      onPress: () => {
        this.scene.start(GAME_SCENE_KEY);
      },
    });

    this.createBestScore(centerX);
    this.createHint(centerX);
  }

  private createMasthead(centerX: number): void {
    createText(this, centerX, 88, '60-SECOND ARCADE ROUND', {
      fontSize: 12,
      color: TEXT.muted,
      letterSpacing: 5,
    }).setOrigin(0.5);

    createText(this, centerX, 146, 'CATCH THE TURTLE', {
      fontSize: 58,
      color: TEXT.primary,
      letterSpacing: 1,
    }).setOrigin(0.5);

    this.add.rectangle(centerX, 198, 96, 1, FILL.border);
  }

  /**
   * Both variants and what each is worth, so the amber one is recognised the
   * first time it appears. Values come from the turtle definitions, so a
   * rebalance updates this screen with no edit here.
   */
  private createTurtleLegend(centerX: number): void {
    const normal = this.addLegendEntry(centerX - 108, TURTLE_TYPES_BY_ID.normal, TEXT.secondary);
    const golden = this.addLegendEntry(centerX + 108, TURTLE_TYPES_BY_ID.golden, TEXT.amber);

    this.tweens.add({
      targets: [normal, golden],
      y: '+=6',
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private addLegendEntry(
    x: number,
    definition: TurtleTypeDefinition,
    labelColor: string,
  ): Phaser.GameObjects.Image {
    const image = createTurtleImage(this, x, 252, definition, 0.62);

    createText(
      this,
      x,
      318,
      `${definition.label.toUpperCase()} · ${String(definition.basePoints)} PTS`,
      { fontSize: 12, color: labelColor, letterSpacing: 2 },
    ).setOrigin(0.5);

    return image;
  }

  /**
   * `StorageService` degrades to an in-memory value when persistence is blocked,
   * so this renders a real number either way and never surfaces a storage error.
   */
  private createBestScore(centerX: number): void {
    const highScore = getStorageService().getHighScore();

    // "BEST 0" is noise, so the row is absent until there is one to beat.
    if (highScore <= 0) {
      return;
    }

    createText(this, centerX, 442, 'BEST', {
      fontSize: 11,
      color: TEXT.muted,
      letterSpacing: 3,
    }).setOrigin(0.5);

    createText(this, centerX, 468, highScore.toLocaleString('en-US'), {
      fontSize: 22,
      color: TEXT.primary,
    }).setOrigin(0.5);
  }

  private createHint(centerX: number): void {
    createText(this, centerX, 510, 'CLICK OR TAP THE TURTLES  ·  ESC TO PAUSE', {
      fontSize: 11,
      color: TEXT.muted,
      letterSpacing: 2,
    }).setOrigin(0.5);
  }
}
