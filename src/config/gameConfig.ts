import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from './dimensions';

import { BootScene } from '../scenes/BootScene';
import { GameOverScene } from '../scenes/GameOverScene';
import { GameScene } from '../scenes/GameScene';
import { MenuScene } from '../scenes/MenuScene';
import { PauseScene } from '../scenes/PauseScene';

export { GAME_HEIGHT, GAME_WIDTH } from './dimensions';

/** Canvas background colour, used until the art phase defines a real palette. */
export const BACKGROUND_COLOR = '#0f1f1b';

/** Directory (relative to the deployment base) that runtime assets load from. */
export const ASSET_BASE_PATH = 'assets/';

/** The id of the element in index.html that Phaser injects its canvas into. */
export const GAME_PARENT_ID = 'game-root';

/**
 * Build the Phaser game configuration.
 *
 * Deliberately omits any physics system: Catch the Turtle resolves hits with a
 * pointer test against a target's hit area, so a physics engine would be weight
 * without purpose.
 */
export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    // WebGL where available, automatic Canvas fallback otherwise.
    type: Phaser.AUTO,
    parent,
    backgroundColor: BACKGROUND_COLOR,
    scale: {
      // Preserve the 16:9 logical resolution and letterbox rather than distort.
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    input: {
      // One pointer is enough for a click-a-target game; mouse, touch and pen all
      // arrive through the same pointer events.
      activePointers: 1,
      mouse: true,
      touch: true,
    },
    // NOTE: antialiasing and `pixelArt` are intentionally left at their defaults.
    // The correct setting depends on the art direction, which is decided in a
    // later phase; choosing now would bake in an assumption about the artwork.
    // Registration order only decides which scene boots first; every transition
    // afterwards is explicit. `PauseScene` is listed last so its overlay renders
    // above the round it freezes.
    scene: [BootScene, MenuScene, GameScene, GameOverScene, PauseScene],
  };
}
