/**
 * Location revival (design system, Biomes): five stages from almost grey to the
 * full biome palette, defined as CSS filters revival-1…revival-5:
 *   saturate(0.1) brightness(0.8) … saturate(1) brightness(1).
 * The world uses the same numbers as a WebGL color matrix, interpolated by
 * revival progress so every lab visibly revives the location.
 */

/** [saturate, brightness] for revival-1…revival-5 (design-system/tokens.css). */
export const REVIVAL_TOKENS: readonly [number, number][] = [
  [0.1, 0.8],
  [0.32, 0.87],
  [0.58, 0.93],
  [0.82, 0.97],
  [1, 1],
];

/** Saturation and brightness for revival progress 0..1. */
export function revivalFilter(progress: number): { saturate: number; brightness: number } {
  const p = Math.max(0, Math.min(1, progress)) * (REVIVAL_TOKENS.length - 1);
  const i = Math.min(REVIVAL_TOKENS.length - 2, Math.floor(p));
  const t = p - i;
  const [s0, b0] = REVIVAL_TOKENS[i];
  const [s1, b1] = REVIVAL_TOKENS[i + 1];
  return { saturate: s0 + (s1 - s0) * t, brightness: b0 + (b1 - b0) * t };
}

/**
 * 4×5 color matrix (row-major, Phaser ColorMatrix layout) equal to the CSS
 * filter `saturate(s) brightness(b)` (W3C Filter Effects formulas).
 */
export function revivalMatrix(progress: number): number[] {
  const { saturate: s, brightness: b } = revivalFilter(progress);
  const m = [
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  ];
  return [
    ...m[0].map((v) => v * b), 0, 0,
    ...m[1].map((v) => v * b), 0, 0,
    ...m[2].map((v) => v * b), 0, 0,
    0, 0, 0, 1, 0,
  ];
}
