/**
 * Logical game resolution. Every gameplay coordinate is in these units; the
 * canvas itself is larger on HiDPI displays (see `renderScale.ts`).
 *
 * Kept out of `gameConfig.ts` so engine-free code can read the playfield size
 * without importing Phaser.
 */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
