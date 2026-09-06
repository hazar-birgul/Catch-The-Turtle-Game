import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '../config/dimensions';
import { createButton } from '../ui/Button';
import { createText, FILL, TEXT } from '../ui/theme';
import { applyLogicalViewport } from '../ui/viewport';

/**
 * The pause overlay, launched alongside a paused `GameScene` so the frozen round
 * stays visible underneath.
 *
 * Escape is handled here as well as in `GameScene` because a paused scene's
 * keyboard plugin is inactive: the key that resumes must belong to the scene
 * that is actually running.
 */

const GAME_SCENE_KEY = 'Game';
const MENU_SCENE_KEY = 'Menu';

export class PauseScene extends Phaser.Scene {
  public static readonly KEY = 'Pause';

  public constructor() {
    super(PauseScene.KEY);
  }

  public create(): void {
    applyLogicalViewport(this);

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, FILL.scrim, 0.88).setOrigin(0, 0);

    const centerX = GAME_WIDTH / 2;

    createText(this, centerX, 158, 'PAUSED', {
      fontSize: 46,
      color: TEXT.primary,
      letterSpacing: 6,
    }).setOrigin(0.5);

    createText(this, centerX, 206, 'Nothing spawns and nothing escapes while you are here', {
      fontSize: 14,
      color: TEXT.muted,
      weight: '600',
    }).setOrigin(0.5);

    createButton(this, {
      x: centerX,
      y: 288,
      label: 'RESUME',
      onPress: () => {
        this.resumeRound();
      },
    });

    createButton(this, {
      x: centerX,
      y: 360,
      label: 'MAIN MENU',
      variant: 'secondary',
      onPress: () => {
        this.quitToMenu();
      },
    });

    createText(this, centerX, 442, 'ESC OR P TO RESUME', {
      fontSize: 11,
      color: TEXT.muted,
      letterSpacing: 3,
    }).setOrigin(0.5);

    this.input.keyboard?.on('keydown-ESC', this.resumeRound);
    this.input.keyboard?.on('keydown-P', this.resumeRound);
  }

  private readonly resumeRound = (): void => {
    // Stop the overlay first, so the resumed round cannot take a pointer press
    // meant for a button on top of it.
    this.scene.stop();
    this.scene.resume(GAME_SCENE_KEY);
  };

  /**
   * Leaving mid-round stops `GameScene` outright rather than leaving it paused, so
   * no spawn tick or expiry timer can survive behind the menu.
   *
   * Both calls queue rather than act immediately: `stop(key)` queues `stop key`,
   * and `start(key)` queues `stop <this scene>` then `start key`, giving
   * `stop Game -> stop Pause -> start Menu` on the next Scene Manager update.
   *
   * `SceneManager.processQueue` runs those ops in a plain loop with no try/catch,
   * so anything that throws in one abandons the rest — see the note on
   * `GameScene.handleShutdown`.
   */
  private quitToMenu(): void {
    this.scene.stop(GAME_SCENE_KEY);
    // `start` stops this overlay on the way out.
    this.scene.start(MENU_SCENE_KEY);
  }
}
