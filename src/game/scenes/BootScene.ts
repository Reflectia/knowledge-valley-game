import Phaser from 'phaser';

// Stage 0 uses the design-system fallback PNGs. The asset manifest arrives in stage 1.
import forestTilesUrl from '../../../images/tiles/forest-tileset-16.png';
import heroineUrl from '../../../images/characters/heroine-front-back-side-16x32.png';

import { TILE_SIZE } from '../constants';

/**
 * Scaffold scene: proves that pixel art renders crisp at integer zoom
 * and that the camera follows a sprite. Replaced by real scenes later.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    this.load.spritesheet('forest-tiles', forestTilesUrl, {
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
    });
    this.load.spritesheet('heroine', heroineUrl, { frameWidth: 16, frameHeight: 32 });
  }

  create(): void {
    const cols = 40;
    const rows = 24;
    // Frames: 0 ground, 1 path, 2 special surface, 3 ground prop, 4 standalone prop.
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const frame = y === 12 ? 1 : (x * 7 + y * 13) % 23 === 0 ? 3 : 0;
        this.add.image(x * TILE_SIZE, y * TILE_SIZE, 'forest-tiles', frame).setOrigin(0);
      }
    }

    const heroine = this.add.sprite((cols / 2) * TILE_SIZE, 12 * TILE_SIZE, 'heroine', 0);

    const camera = this.cameras.main;
    camera.setZoom(this.registry.get('worldScale') as number);
    camera.setBounds(0, 0, cols * TILE_SIZE, rows * TILE_SIZE);
    camera.startFollow(heroine, true);

    const cursors = this.input.keyboard!.createCursorKeys();
    const speed = 60; // source pixels per second
    this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => {
      const step = (speed * dt) / 1000;
      if (cursors.left.isDown) {
        heroine.x -= step;
        heroine.setFrame(2).setFlipX(true);
      } else if (cursors.right.isDown) {
        heroine.x += step;
        heroine.setFrame(2).setFlipX(false);
      }
      if (cursors.up.isDown) {
        heroine.y -= step;
        heroine.setFrame(1);
      } else if (cursors.down.isDown) {
        heroine.y += step;
        heroine.setFrame(0);
      }
    });
  }
}
