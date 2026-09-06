import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from './dimensions';
import { getRenderScale } from './renderScale';

import { BootScene } from '../scenes/BootScene';
import { GameOverScene } from '../scenes/GameOverScene';
import { GameScene } from '../scenes/GameScene';
import { MenuScene } from '../scenes/MenuScene';
import { PauseScene } from '../scenes/PauseScene';

export { GAME_HEIGHT, GAME_WIDTH } from './dimensions';

/** Kept in step with `FILL.background`; Phaser's config takes a CSS string. */
export const BACKGROUND_COLOR = '#0a0a0a';

/** Directory, relative to the deployment base, that runtime assets load from. */
export const ASSET_BASE_PATH = 'assets/';

export const GAME_PARENT_ID = 'game-root';

/**
 * No physics system: hits are resolved by a pointer test against the target's
 * hit area, so a physics engine would be weight without purpose.
 */
export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  const renderScale = getRenderScale();

  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: BACKGROUND_COLOR,
    scale: {
      mode: Phaser.Scale.FIT,
      /*
       * CSS owns positioning; Phaser owns sizing. Only one may centre the canvas.
       *
       * `CENTER_BOTH` writes `marginLeft`/`marginTop` onto the canvas, and the
       * page shell already centres it with `place-items: center` — which measures
       * an item by its outer size, margins included. Stacked, the two leave the
       * canvas off-centre by half the margin.
       *
       * CSS wins the tie-break: `#game-root` carries `env(safe-area-inset-*)`
       * padding, and Phaser measures its parent with `getBoundingClientRect()`,
       * which includes padding — so it would centre against the border box and
       * push the canvas under a notch.
       */
      autoCenter: Phaser.Scale.NO_CENTER,
      /*
       * Sized in device pixels, not logical ones. Phaser has no devicePixelRatio
       * support: FIT sets the backing store to exactly these numbers and then
       * scales it with CSS, so 960x540 would leave every frame upscaled.
       *
       * This is the only place the game is not expressed in logical units;
       * `ui/viewport.ts` zooms each scene camera by the same factor. The aspect
       * ratio is unchanged, so FIT letterboxes exactly as it would at 960x540.
       */
      width: GAME_WIDTH * renderScale,
      height: GAME_HEIGHT * renderScale,
    },
    input: {
      // Mouse, touch and pen all arrive through the same pointer events.
      activePointers: 1,
      mouse: true,
      touch: true,
    },
    render: {
      /*
       * Snaps unscaled textured objects to whole pixels, which stops a Text
       * centred on a half pixel being resampled across two texels. Inert above a
       * render scale of 1, where a zoomed camera makes the matrix non-identity
       * and `willRoundVertices` declines — by then a half logical pixel is
       * already a whole device pixel.
       */
      roundPixels: true,
    },
    // `PauseScene` is last so its overlay renders above the round it freezes.
    // Order otherwise only decides which scene boots first.
    scene: [BootScene, MenuScene, GameScene, GameOverScene, PauseScene],
  };
}
