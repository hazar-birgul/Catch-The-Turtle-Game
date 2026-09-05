import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '../config/dimensions';
import { createButton } from '../ui/Button';
import { FILL, FONT_STACK, TEXT } from '../ui/theme';

/**
 * The pause overlay.
 *
 * Launched alongside a paused `GameScene` rather than replacing it, so the frozen
 * round stays visible underneath. A paused Phaser scene receives no `update`, no
 * Clock ticks and no input, which is why nothing in the gameplay code has to know
 * that pausing exists — the freeze is a property of the scene, not a flag threaded
 * through the round.
 *
 * Escape is handled here rather than in `GameScene` for the same reason: a paused
 * scene's keyboard plugin is inactive, so the key that resumes the game must
 * belong to the scene that is actually running.
 */

const GAME_SCENE_KEY = 'Game';
const MENU_SCENE_KEY = 'Menu';

export class PauseScene extends Phaser.Scene {
  public static readonly KEY = 'Pause';

  public constructor() {
    super(PauseScene.KEY);
  }

  public create(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, FILL.background, 0.82).setOrigin(0, 0);

    const centerX = GAME_WIDTH / 2;

    this.add
      .text(centerX, 172, 'PAUSED', {
        fontFamily: FONT_STACK,
        fontSize: '48px',
        fontStyle: '700',
        color: TEXT.primary,
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, 218, 'The round is frozen — nothing spawns and nothing escapes', {
        fontFamily: FONT_STACK,
        fontSize: '15px',
        color: TEXT.muted,
      })
      .setOrigin(0.5);

    createButton(this, {
      x: centerX,
      y: 300,
      label: 'RESUME',
      onPress: () => {
        this.resumeRound();
      },
    });

    createButton(this, {
      x: centerX,
      y: 374,
      label: 'MAIN MENU',
      variant: 'secondary',
      onPress: () => {
        this.quitToMenu();
      },
    });

    this.input.keyboard?.on('keydown-ESC', this.resumeRound);
    this.input.keyboard?.on('keydown-P', this.resumeRound);
  }

  private readonly resumeRound = (): void => {
    // Stop this overlay first, so the resumed round cannot take a pointer press
    // that was meant for a button on top of it.
    this.scene.stop();
    this.scene.resume(GAME_SCENE_KEY);
  };

  /**
   * Leaving mid-round stops `GameScene` outright rather than leaving it paused.
   * A paused scene keeps its display list, its timers and its state alive; a
   * stopped one is shut down, which is what guarantees no stale spawn tick or
   * expiry timer can fire behind the menu.
   */
  private quitToMenu(): void {
    this.scene.stop(GAME_SCENE_KEY);
    // `start` stops this overlay on the way out, so no separate stop is needed.
    this.scene.start(MENU_SCENE_KEY);
  }
}
