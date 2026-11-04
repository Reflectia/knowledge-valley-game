import Phaser from 'phaser';

import { preloadAll } from '../assets/loader';
import { ENEMIES, ITEMS, TEMP_FRAMES } from '../assets/manifest';
import { ensureHeroine, heroineAnim, type Facing } from '../assets/heroine';
import type { StoreApi } from 'zustand/vanilla';

import type { GameState } from '@/state/store';

import type { Appearance } from '../assets/recolor';
import { TILE_SIZE } from '../constants';
import { LIGHT, LIGHT_RADIUS } from '../lighting/lightmap';
import { NightLayer, createGlowOverlay } from '../lighting/NightLayer';

/** Lantern glass color in lamp-post.png (set by scripts/assets/build_sprites.py). */
const LAMP_GLASS_RGB: [number, number, number] = [58, 66, 78];

const T = TILE_SIZE;

/**
 * Temporary homestead patch with the prepared sprites (the real homestead map
 * comes in stage 5). Arrows walk; N toggles night (dev). The heroine's look
 * follows the player's appearance in the game store.
 */
export class BootScene extends Phaser.Scene {
  private store!: StoreApi<GameState>;
  private heroine!: Phaser.GameObjects.Sprite;
  private heroineKey = '';
  private facing: Facing = 'down';
  private night!: NightLayer;
  private nightOverlays: Phaser.GameObjects.Image[] = [];

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
    const windowLit = this.add
      .image(house.x + meta['window-lit'].x, house.y - house.height + meta['window-lit'].y, 'homestead-window-lit')
      .setOrigin(0);
    this.add.image(houseX + house.width + 8, houseY - 40, 'tree-blossom-a').setOrigin(0.5, 1);
    this.add.image(houseX + house.width + 30, houseY, 'tree-blossom-b').setOrigin(0.5, 1);
    const lamp = this.add.image(houseX + house.width + 6, houseY, 'lamp-post').setOrigin(0.5, 1);

    // Night: lantern glass glows; window and lantern cast warm dithered light.
    const glass = createGlowOverlay(this, 'lamp-post', 'lamp-post-lit', LAMP_GLASS_RGB, LIGHT.warm);
    const lampLit = this.add.image(lamp.x, lamp.y, 'lamp-post-lit').setOrigin(0.5, 1);
    this.nightOverlays = [windowLit, lampLit];
    const lampLeft = lamp.x - lamp.width / 2;
    const lampTop = lamp.y - lamp.height;
    const lights = [
      {
        x: windowLit.x + windowLit.width / 2,
        y: windowLit.y + windowLit.height / 2,
        radius: LIGHT_RADIUS.window,
        color: LIGHT.window,
      },
      {
        x: lampLeft + (glass ? glass.x + glass.w / 2 : lamp.width / 2),
        y: lampTop + (glass ? glass.y + glass.h / 2 : 8),
        radius: LIGHT_RADIUS.lamp,
        color: LIGHT.warm,
      },
    ];

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

    this.store = this.registry.get('store') as StoreApi<GameState>;
    this.heroineKey = ensureHeroine(this, this.store.getState().world.state.player.appearance);
    this.heroine = this.add.sprite(12 * T, (path + 1) * T, this.heroineKey, 0).setOrigin(0.5, 1);
    this.heroine.play(heroineAnim(this.heroineKey, 'down', false).anim);

    this.night = new NightLayer(this, cols * T, rows * T).setDepth(10).setVisible(false);
    this.night.setLights(lights);
    for (const o of this.nightOverlays) o.setDepth(11).setVisible(false);

    const camera = this.cameras.main;
    camera.setZoom(this.registry.get('worldScale') as number);
    camera.setBounds(0, 0, cols * T, rows * T);
    camera.startFollow(this.heroine, true);

    const kb = this.input.keyboard!;
    const unsubscribe = this.store.subscribe((st, prev) => {
      const a = st.world.state.player.appearance;
      if (a !== prev.world.state.player.appearance) this.setAppearance(a);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    kb.on('keydown-N', () => {
      const on = !this.night.image.visible;
      this.night.setVisible(on);
      for (const o of this.nightOverlays) o.setVisible(on);
    });

    const cursors = kb.createCursorKeys();
    this.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dt: number) => this.move(cursors, dt));
  }

  private setAppearance(appearance: Appearance): void {
    this.heroineKey = ensureHeroine(this, appearance);
    // Switch texture and animation together; the previous texture stays cached.
    this.heroine.play(heroineAnim(this.heroineKey, this.facing, false).anim);
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
    const { anim, flipX } = heroineAnim(this.heroineKey, this.facing, moving);
    this.heroine.setFlipX(flipX);
    if (this.heroine.anims.currentAnim?.key !== anim) this.heroine.play(anim);
  }
}
