import Phaser from 'phaser';

import { preloadAll } from '../assets/loader';
import { ENEMIES, ITEMS, TEMP_FRAMES } from '../assets/manifest';
import { createHeroineAnimations, createHeroineTexture, heroineAnim, type Facing } from '../assets/heroine';
import { DEFAULT_APPEARANCE, type Appearance, type HeroinePalettes, type Role } from '../assets/recolor';
import { TILE_SIZE } from '../constants';

const T = TILE_SIZE;

/**
 * Stage 1 asset preview: the prepared sprites on a small homestead patch.
 * Arrows walk; H / S / C cycle hair / skin / shirt; N toggles night.
 * Replaced by the real homestead scene in stage 5.
 */
export class BootScene extends Phaser.Scene {
  private appearance: Appearance = { ...DEFAULT_APPEARANCE };
  private heroine!: Phaser.GameObjects.Sprite;
  private facing: Facing = 'down';
  private night!: Phaser.GameObjects.Rectangle;
  private windowLit!: Phaser.GameObjects.Image;

  constructor() {
    super('boot');
  }

  preload(): void {
    preloadAll(this);
  }

  create(): void {
    const cols = 30;
    const rows = 18;
    const path = 11;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const frame = y === path || y === path + 1 ? 2 : (x * 7 + y * 13) % 17 === 0 ? 1 : 0;
        this.add.image(x * T, y * T, 'homestead-tiles', frame).setOrigin(0);
      }
    }

    // House, trees and lamp: origin at the bottom so y is where they stand.
    const houseX = 4 * T;
    const houseY = path * T;
    const house = this.add.image(houseX, houseY, 'homestead-house').setOrigin(0, 1);
    const meta = this.cache.json.get('homestead-meta') as { 'window-lit': { x: number; y: number } };
    this.windowLit = this.add
      .image(house.x + meta['window-lit'].x, house.y - house.height + meta['window-lit'].y, 'homestead-window-lit')
      .setOrigin(0)
      .setVisible(false);
    this.add.image(houseX + house.width + 8, houseY - 40, 'tree-blossom-a').setOrigin(0.5, 1);
    this.add.image(houseX + house.width + 30, houseY, 'tree-blossom-b').setOrigin(0.5, 1);
    this.add.image(houseX + house.width + 6, houseY, 'lamp-post').setOrigin(0.5, 1);

    // Garden bed with every growth stage of the first crops (temporary pack).
    for (let crop = 0; crop < 4; crop++) {
      const row = Math.floor(crop / 2);
      const first = row * TEMP_FRAMES.cropColumns + (crop % 2) * 6;
      for (let stage = 5; stage >= 0; stage--) {
        const x = (14 + (5 - stage)) * T;
        const y = (2 + crop) * T;
        this.add.image(x, y, 'temp-farm', TEMP_FRAMES.soilBed).setOrigin(0).setAlpha(stage === 0 ? 0 : 1);
        this.add.image(x, y, 'temp-crops', first + stage).setOrigin(0);
      }
    }

    // Enemies and items in a row below the path.
    ENEMIES.forEach((id, i) => this.add.image((2 + i * 2) * T, 15 * T, `enemy-${id}`).setOrigin(0));
    ITEMS.forEach((id, i) => this.add.image((20 + i * 2) * T, 15 * T, `item-${id}`).setOrigin(0));
    const tools = [TEMP_FRAMES.wateringCan, TEMP_FRAMES.hoe, TEMP_FRAMES.axe];
    tools.forEach((f, i) => this.add.image((22 + i * 2) * T, 2 * T, 'temp-farm', f).setOrigin(0));

    this.buildHeroine();
    this.heroine = this.add.sprite(12 * T, (path + 1) * T, 'heroine-custom', 0).setOrigin(0.5, 1);
    this.heroine.play(heroineAnim('heroine-custom', 'down', false).anim);

    this.night = this.add
      .rectangle(0, 0, cols * T, rows * T, 0x4a5788) // light-night
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setVisible(false);
    this.windowLit.setDepth(1);
    this.night.setDepth(0.5);

    const camera = this.cameras.main;
    camera.setZoom(this.registry.get('worldScale') as number);
    camera.setBounds(0, 0, cols * T, rows * T);
    camera.startFollow(this.heroine, true);

    const kb = this.input.keyboard!;
    kb.on('keydown-H', () => this.cycle('hair'));
    kb.on('keydown-S', () => this.cycle('skin'));
    kb.on('keydown-C', () => this.cycle('shirt'));
    kb.on('keydown-N', () => {
      const on = !this.night.visible;
      this.night.setVisible(on);
      this.windowLit.setVisible(on);
    });

    const cursors = kb.createCursorKeys();
    this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => this.move(cursors, dt));
  }

  private buildHeroine(): void {
    createHeroineTexture(this, 'heroine-custom', this.appearance);
    createHeroineAnimations(this, 'heroine-custom');
  }

  private cycle(role: Role): void {
    const options = Object.keys((this.cache.json.get('heroine-palettes') as HeroinePalettes)[role].options);
    this.appearance[role] = options[(options.indexOf(this.appearance[role]) + 1) % options.length];
    this.buildHeroine();
    this.heroine.setTexture('heroine-custom', 0);
    this.heroine.play(heroineAnim('heroine-custom', this.facing, false).anim);
  }

  private move(cursors: Phaser.Types.Input.Keyboard.CursorKeys, dt: number): void {
    const step = (60 * dt) / 1000;
    let dx = 0;
    let dy = 0;
    if (cursors.left.isDown) dx -= 1;
    if (cursors.right.isDown) dx += 1;
    if (cursors.up.isDown) dy -= 1;
    if (cursors.down.isDown) dy += 1;
    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      this.facing = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
      const len = Math.hypot(dx, dy);
      this.heroine.x += (dx / len) * step;
      this.heroine.y += (dy / len) * step;
    }
    const { anim, flipX } = heroineAnim('heroine-custom', this.facing, moving);
    this.heroine.setFlipX(flipX);
    if (this.heroine.anims.currentAnim?.key !== anim) this.heroine.play(anim);
  }
}
