import Phaser from 'phaser';

import { ASSET_BASE_PATH } from '../config/gameConfig';
import { joinBase } from '../utils/paths';

/**
 * First scene to run. Configures the asset loader and hands off to the menu.
 *
 * No assets are loaded yet — the game currently draws everything programmatically
 * and real artwork arrives in a later phase. The loader is nevertheless wired up
 * now so that the very first asset added inherits the correct deployment base and
 * cannot introduce the "works locally, 404s on GitHub Pages" bug.
 */
export class BootScene extends Phaser.Scene {
  public static readonly KEY = 'Boot';

  public constructor() {
    super(BootScene.KEY);
  }

  public preload(): void {
    // `import.meta.env.BASE_URL` is '/' in development and '/<repo>/' in a
    // production build. Phaser's loader takes runtime URL strings that Vite
    // cannot rewrite at build time, so the base has to be applied here.
    this.load.setBaseURL(joinBase(import.meta.env.BASE_URL, ASSET_BASE_PATH));

    // Assets are loaded here from the art phase onwards, e.g.
    //   this.load.image('turtle', 'sprites/turtle.png');
    // which resolves to <base>/assets/sprites/turtle.png.
  }

  public create(): void {
    this.scene.start('Menu');
  }
}
