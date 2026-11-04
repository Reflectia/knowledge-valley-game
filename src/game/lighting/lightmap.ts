/**
 * Night lighting (design system, DayNight): the world is multiplied by an ambient
 * color; warm sources light two rings with pixel dithering, no soft gradients.
 * The map is painted in world pixels (1 texel = 1 source pixel), so the dithering
 * stays on the pixel-art grid at any integer zoom.
 */

export interface Light {
  x: number;
  y: number;
  radius: number;
  color: number; // 0xRRGGBB
}

/** Design tokens (design-system/tokens.css). */
export const LIGHT = {
  night: 0x4a5788, // light-night
  warm: 0xffc861, // light-warm (lanterns, radius 20)
  window: 0xffad42, // light-window (windows, radius 14)
  firefly: 0xe9f77c, // light-firefly (radius 3)
} as const;

export const LIGHT_RADIUS = { lamp: 20, window: 14, firefly: 3 } as const;

/** Fraction of the radius lit fully; the rest is the dithered outer ring. */
export const INNER_RING = 0.55;

const r = (c: number) => (c >> 16) & 255;
const g = (c: number) => (c >> 8) & 255;
const b = (c: number) => c & 255;

/** Paint an RGBA multiply map in place. */
export function paintLightmap(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  ambient: number,
  lights: Light[],
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let cr = r(ambient);
      let cg = g(ambient);
      let cb = b(ambient);
      for (const l of lights) {
        const dx = x + 0.5 - l.x;
        const dy = y + 0.5 - l.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > l.radius * l.radius) continue;
        const inner = d2 <= (l.radius * INNER_RING) ** 2;
        // Outer ring: checkerboard dither between ambient and the light color.
        if (!inner && ((x + y) & 1) === 1) continue;
        // Several lights: the brightest channel wins (no over-bright sums).
        cr = Math.max(cr, r(l.color));
        cg = Math.max(cg, g(l.color));
        cb = Math.max(cb, b(l.color));
      }
      const i = (y * width + x) * 4;
      data[i] = cr;
      data[i + 1] = cg;
      data[i + 2] = cb;
      data[i + 3] = 255;
    }
  }
}
