import Phaser from 'phaser';

import { ASSET_BASE_PATH } from '../config/gameConfig';
import { joinBase } from '../utils/paths';

/** Configures the asset loader, then hands off to the menu. */
export class BootScene extends Phaser.Scene {
  public static readonly KEY = 'Boot';

  public constructor() {
    super(BootScene.KEY);
  }

  public preload(): void {
    /*
     * Phaser's loader takes runtime URL strings, which Vite cannot rewrite at
     * build time, so the deployment base has to be applied here. Without it the
     * first asset added would work locally and 404 on GitHub Pages.
     */
    this.load.setBaseURL(joinBase(import.meta.env.BASE_URL, ASSET_BASE_PATH));
  }

  public create(): void {
    this.scene.start('Menu');
  }
}
