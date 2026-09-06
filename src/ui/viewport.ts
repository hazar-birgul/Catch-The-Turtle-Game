import Phaser from 'phaser';

import { GAME_HEIGHT, GAME_WIDTH } from '../config/dimensions';
import { getRenderScale } from '../config/renderScale';

/**
 * Map a scene's camera onto the 960x540 logical world.
 *
 * The canvas is `GAME_WIDTH * R` by `GAME_HEIGHT * R` device pixels, so without
 * this a scene would see a world that large and the layout would sit in the
 * top-left corner at 1/R size.
 *
 * Phaser composes the view matrix as `screen = (world - scroll - origin) * zoom
 * + origin`, where `origin = cameraWidth * camera.originX`. The camera is created
 * at the game size, and `centerOn` sets `scroll = x - cameraWidth / 2` without
 * dividing by the zoom, which works out to `GAME_WIDTH * (1 - R) / 2` — mapping
 * logical 0..960 onto the full canvas for any R.
 *
 * Two things that look like simplifications but are not:
 *
 * - The default camera origin of 0.5 must stay. `worldView` is derived from
 *   `scroll + cameraWidth / 2` regardless of the origin, so an origin of 0 would
 *   leave it describing a region the camera is not looking at, and `worldView`
 *   drives culling.
 * - Pointer coordinates need no adjustment. `ScaleManager` scales them by
 *   `baseSize / canvasBounds` and `InputManager.hitTest` runs them through
 *   `camera.getWorldPoint`, which inverts the matrix above. Adding a manual
 *   transform would apply it twice.
 */
export function applyLogicalViewport(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(getRenderScale()).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
}
