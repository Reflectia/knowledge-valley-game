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
  // Ambient everywhere first, then each light only inside its own bounding box.
  const ar = r(ambient);
  const ag = g(ambient);
  const ab = b(ambient);
  for (let i = 0; i < width * height * 4; i += 4) {
    data[i] = ar;
    data[i + 1] = ag;
    data[i + 2] = ab;
    data[i + 3] = 255;
  }
  for (const l of lights) {
    const x0 = Math.max(0, Math.floor(l.x - l.radius));
    const x1 = Math.min(width - 1, Math.ceil(l.x + l.radius));
    const y0 = Math.max(0, Math.floor(l.y - l.radius));
    const y1 = Math.min(height - 1, Math.ceil(l.y + l.radius));
    const lr = r(l.color);
    const lg = g(l.color);
    const lb = b(l.color);
    const r2 = l.radius * l.radius;
    const in2 = (l.radius * INNER_RING) ** 2;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - l.x;
        const dy = y + 0.5 - l.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        // Outer ring: checkerboard dither between ambient and the light color.
        if (d2 > in2 && ((x + y) & 1) === 1) continue;
        // Several lights: the brightest channel wins (no over-bright sums).
        const i = (y * width + x) * 4;
        data[i] = Math.max(data[i], lr);
        data[i + 1] = Math.max(data[i + 1], lg);
        data[i + 2] = Math.max(data[i + 2], lb);
      }
    }
  }
}
