import Phaser from 'phaser';

import { preloadAll } from '../assets/loader';

/** Loads every manifest asset (textures, maps), then starts the world at home. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('preload');
  }

  preload(): void {
    preloadAll(this);
  }

  create(): void {
    this.scene.start('world', { map: 'house', spawn: 'bed' });
  }
}
