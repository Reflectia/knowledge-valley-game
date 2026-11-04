/** Native tile size in source pixels. */
export const TILE_SIZE = 16;

/**
 * World zoom: integer multiples only.
 * x3 at 1280×720 (48 px tiles), x4 from 1920×1080 — per design-system README.
 */
export function worldScaleFor(width: number, height: number): 3 | 4 {
  return width >= 1920 && height >= 1080 ? 4 : 3;
}
