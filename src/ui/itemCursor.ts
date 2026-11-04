/**
 * Mouse cursor showing the selected toolbar item over the world. The item icon
 * is drawn ×2 into a 32×32 image (crisp, no smoothing) and used as a CSS cursor
 * with the hotspot in the middle, where the tile outline is.
 */
import { ITEMS, type ItemIcon } from '@/core/items';
import { ASSETS, type SheetAsset } from '@/game/assets/manifest';

const SIZE = 16;
const SCALE = 2;
const cache = new Map<string, Promise<string | null>>();
const images = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string): Promise<HTMLImageElement> {
  let p = images.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
    images.set(url, p);
  }
  return p;
}

async function drawIcon(ctx: CanvasRenderingContext2D, icon: ItemIcon, x: number, y: number, scale: number) {
  if (icon.sheet !== undefined && icon.frame !== undefined) {
    const a = ASSETS[icon.sheet] as SheetAsset;
    const img = await loadImage(a.url);
    const step = SIZE + (a.spacing ?? 0);
    const sx = (icon.frame % a.columns) * step;
    const sy = Math.floor(icon.frame / a.columns) * step;
    ctx.drawImage(img, sx, sy, SIZE, SIZE, x, y, SIZE * scale, SIZE * scale);
  } else if (icon.texture) {
    const img = await loadImage(ASSETS[icon.texture].url);
    ctx.drawImage(img, 0, 0, img.width, img.height, x, y, SIZE * scale, SIZE * scale);
  }
}

/** A CSS `cursor` value for the item, or null when it cannot be drawn. */
export function itemCursor(id: string): Promise<string | null> {
  let p = cache.get(id);
  if (!p) {
    p = (async () => {
      const item = ITEMS[id];
      if (!item) return null;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE * SCALE;
      canvas.height = SIZE * SCALE;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      try {
        await drawIcon(ctx, item.icon, 0, 0, SCALE);
        if (item.badge) await drawIcon(ctx, item.badge, SIZE * SCALE - SIZE, 0, 1);
      } catch {
        return null;
      }
      const half = (SIZE * SCALE) / 2;
      return `url(${canvas.toDataURL('image/png')}) ${half} ${half}, auto`;
    })();
    cache.set(id, p);
  }
  return p;
}
