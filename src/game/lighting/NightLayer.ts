import Phaser from 'phaser';

import { LIGHT, paintLightmap, type Light } from './lightmap';

/**
 * A world-sized multiply layer with warm light sources painted in.
 * Sits above the world and below lit overlays (windows, lantern glass) and the UI.
 */
export class NightLayer {
  private readonly texture: Phaser.Textures.CanvasTexture;
  readonly image: Phaser.GameObjects.Image;
  private lights: Light[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly width: number,
    private readonly height: number,
    key = 'night-lightmap',
  ) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.texture = scene.textures.createCanvas(key, width, height)!;
    this.image = scene.add.image(0, 0, key).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  setLights(lights: Light[], ambient: number = LIGHT.night): void {
    this.lights = lights;
    const ctx = this.texture.getContext();
    const img = ctx.createImageData(this.width, this.height);
    paintLightmap(img.data, this.width, this.height, ambient, this.lights);
    ctx.putImageData(img, 0, 0);
    this.texture.refresh();
  }

  setVisible(on: boolean): this {
    this.image.setVisible(on);
    return this;
  }

  setDepth(depth: number): this {
    this.image.setDepth(depth);
    return this;
  }
}

/**
 * Build an overlay texture from the pixels of `sourceKey` that match `rgb`,
 * painted in `color` (e.g. lantern glass glowing at night). Returns the bounding
 * box of the matched pixels inside the source, for placing the light.
 */
export function createGlowOverlay(
  scene: Phaser.Scene,
  sourceKey: string,
  overlayKey: string,
  rgb: [number, number, number],
  color: number,
): { x: number; y: number; w: number; h: number } | null {
  const src = scene.textures.get(sourceKey).getSourceImage() as HTMLImageElement;
  const tex = scene.textures.exists(overlayKey)
    ? (scene.textures.get(overlayKey) as Phaser.Textures.CanvasTexture)
    : scene.textures.createCanvas(overlayKey, src.width, src.height)!;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, src.width, src.height);
  const d = img.data;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < d.length; i += 4) {
    const hit = d[i + 3] > 0 && d[i] === rgb[0] && d[i + 1] === rgb[1] && d[i + 2] === rgb[2];
    if (!hit) {
      d[i + 3] = 0;
      continue;
    }
    d[i] = (color >> 16) & 255;
    d[i + 1] = (color >> 8) & 255;
    d[i + 2] = color & 255;
    const p = i / 4;
    const x = p % src.width;
    const y = Math.floor(p / src.width);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
