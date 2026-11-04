import Phaser from 'phaser';

import { TILE_SIZE, worldScaleFor } from './constants';
import { BootScene } from './scenes/BootScene';

let game: Phaser.Game | null = null;

export function startGame(parent: HTMLElement): Phaser.Game {
  if (game) return game;

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#2e1b12', // wood-900, matches the page background
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    scene: [BootScene],
  });

  game.registry.set('tileSize', TILE_SIZE);
  game.registry.set('worldScale', worldScaleFor(window.innerWidth, window.innerHeight));

  return game;
}
