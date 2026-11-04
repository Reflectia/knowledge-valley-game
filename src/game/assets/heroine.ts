import Phaser from 'phaser';

import { buildSwapTable, recolorPixels, type Appearance, type HeroinePalettes } from './recolor';

export const HEROINE_FRAME = { w: 16, h: 32 } as const;
export type Facing = 'down' | 'up' | 'right' | 'left';

const ROW: Record<Exclude<Facing, 'left'>, number> = { down: 0, up: 1, right: 2 };
const FRAMES_PER_ROW = 4;

/** Texture key for one appearance; each combination gets its own texture. */
export function heroineTextureKey(a: Appearance): string {
  return `heroine-${a.hair}-${a.skin}-${a.shirt}`;
}

/**
 * Return the texture key for this appearance, creating the recolored texture and its
 * animations on first use. Textures are never removed while a sprite may still use
 * them (removing a texture under a playing sprite crashes the renderer); there are
 * at most 4×4×4 = 64 combinations of 64×96 px, so caching them all is cheap.
 */
export function ensureHeroine(scene: Phaser.Scene, appearance: Appearance): string {
  const key = heroineTextureKey(appearance);
  if (!scene.textures.exists(key)) {
    createHeroineTexture(scene, key, appearance);
  }
  createHeroineAnimations(scene, key);
  return key;
}

function createHeroineTexture(scene: Phaser.Scene, key: string, appearance: Appearance): void {
  const source = scene.textures.get('heroine').getSourceImage() as HTMLImageElement;
  const tex = scene.textures.createCanvas(key, source.width, source.height)!;
  const ctx = tex.getContext();
  ctx.drawImage(source, 0, 0);
  const pixels = ctx.getImageData(0, 0, source.width, source.height);
  const palettes = scene.cache.json.get('heroine-palettes') as HeroinePalettes;
  recolorPixels(pixels.data, buildSwapTable(palettes, appearance));
  ctx.putImageData(pixels, 0, 0);
  tex.refresh();

  const cols = source.width / HEROINE_FRAME.w;
  const rows = source.height / HEROINE_FRAME.h;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tex.add(r * cols + c, 0, c * HEROINE_FRAME.w, r * HEROINE_FRAME.h, HEROINE_FRAME.w, HEROINE_FRAME.h);
    }
  }
}

/** Walk + idle animations for a heroine texture: `${key}-walk-down`, `${key}-idle-up`, … (created once). */
function createHeroineAnimations(scene: Phaser.Scene, key: string): void {
  for (const [dir, row] of Object.entries(ROW)) {
    const first = row * FRAMES_PER_ROW;
    const walk = `${key}-walk-${dir}`;
    const idle = `${key}-idle-${dir}`;
    if (!scene.anims.exists(walk)) {
      scene.anims.create({
        key: walk,
        frames: scene.anims.generateFrameNumbers(key, { start: first, end: first + FRAMES_PER_ROW - 1 }),
        frameRate: 8,
        repeat: -1,
      });
    }
    if (!scene.anims.exists(idle)) {
      scene.anims.create({ key: idle, frames: [{ key, frame: first }], frameRate: 1 });
    }
  }
}

/** Animation key + horizontal flip for a facing (left mirrors right). */
export function heroineAnim(key: string, facing: Facing, moving: boolean): { anim: string; flipX: boolean } {
  const dir = facing === 'left' ? 'right' : facing;
  return { anim: `${key}-${moving ? 'walk' : 'idle'}-${dir}`, flipX: facing === 'left' };
}
