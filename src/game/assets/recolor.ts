/**
 * Heroine customization by palette swap (decision: one base sprite, recolored).
 * The tables come from public/assets/characters/heroine-palettes.json, generated
 * by scripts/assets/build_heroine.py.
 */

export type Role = 'hair' | 'skin' | 'shirt';

export interface RolePalette {
  base: string[];
  options: Record<string, string[]>;
}

export type HeroinePalettes = Record<Role, RolePalette>;

export type Appearance = Record<Role, string>;

export const DEFAULT_APPEARANCE: Appearance = { hair: 'red', skin: 'light', shirt: 'green' };

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Packed 0xRRGGBB → replacement [r, g, b] for the chosen options. */
export function buildSwapTable(palettes: HeroinePalettes, choice: Appearance): Map<number, [number, number, number]> {
  const table = new Map<number, [number, number, number]>();
  for (const role of Object.keys(palettes) as Role[]) {
    const { base, options } = palettes[role];
    const target = options[choice[role]];
    if (!target) throw new Error(`Unknown ${role} option: ${choice[role]}`);
    base.forEach((hex, i) => {
      table.set(parseInt(hex.slice(1), 16), hexToRgb(target[i]));
    });
  }
  return table;
}

/** Recolor RGBA pixels in place. Transparent pixels are left untouched. */
export function recolorPixels(data: Uint8ClampedArray, table: Map<number, [number, number, number]>): void {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const rgb = table.get((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    if (rgb) {
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
    }
  }
}
