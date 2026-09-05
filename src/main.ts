import Phaser from 'phaser';

import { createGameConfig, GAME_PARENT_ID } from './config/gameConfig';

const parent = document.getElementById(GAME_PARENT_ID);

if (parent === null) {
  throw new Error(`Cannot start the game: no #${GAME_PARENT_ID} element in the document.`);
}

// Phaser defers its own boot until DOMContentLoaded, so constructing the game
// here is safe regardless of where this module is executed in the page.
new Phaser.Game(createGameConfig(parent));
