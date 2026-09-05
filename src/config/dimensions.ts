/**
 * Logical game resolution.
 *
 * All gameplay coordinates are expressed in these units; Phaser's Scale Manager
 * maps them onto whatever the device actually provides.
 *
 * These live apart from `gameConfig.ts` so that Phaser-free gameplay code can
 * reference the playfield size without importing the engine.
 */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
