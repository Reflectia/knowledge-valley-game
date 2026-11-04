/**
 * Discipline buildings on the homestead (spec §3): a plot that grows into a
 * building over 5 levels as labs are done. Temporary art assembled from
 * Kenney Tiny Town tiles (ASSETS-TODO.md); replace with real building sprites later.
 */

export type BuildingStyle = 'red' | 'gray' | 'mixed';

/** Roof color / wall material per theme pack (temporary look). */
export const PACK_STYLE: Record<string, BuildingStyle> = {
  forest: 'red',
  market: 'red',
  tower: 'gray',
  library: 'gray',
  forge: 'mixed',
};

// Tiny Town frames (12 columns): roof rows and wall rows.
const ROOF = {
  red: { top: [52, 53, 54], bottom: [64, 65, 66] },
  gray: { top: [48, 49, 50], bottom: [60, 61, 62] },
};
// upper: left edge, plain, open arch, right edge
const WALL = {
  brown: { upper: [72, 73, 74, 75], window: 84, door: 85, doubleL: 86, doubleR: 87 },
  gray: { upper: [76, 77, 78, 79], window: 88, door: 89, doubleL: 90, doubleR: 91 },
};

/** A roof row of width w from [left, middle, right]. */
function roofRow([l, m, r]: number[], w: number): number[] {
  return [l, ...Array(Math.max(0, w - 2)).fill(m), r];
}

/**
 * Tile frames (rows top → bottom) for a building level 1..5, or null for an
 * empty plot (level 0). Every level is visibly bigger than the previous one.
 */
export function buildingTiles(level: number, style: BuildingStyle): number[][] | null {
  if (level <= 0) return null;
  const roof = ROOF[style === 'red' ? 'red' : 'gray'];
  const wall = WALL[style === 'gray' ? 'gray' : 'brown'];
  // upper[2] is an open arch (transparent): the walls use only the solid pieces.
  const [uL, uM, , uR] = wall.upper;
  const width = [0, 2, 3, 4, 4, 5][Math.min(5, level)];
  const rows: number[][] = [roofRow(roof.top, width), roofRow(roof.bottom, width)];
  if (level >= 4) {
    rows.push(level === 5 ? [uL, uM, uM, uM, uR] : [uL, uM, uM, uR]);
  }
  const lower: Record<number, number[]> = {
    1: [wall.window, wall.door],
    2: [wall.window, wall.door, wall.window],
    3: [wall.window, wall.doubleL, wall.doubleR, wall.window],
    4: [wall.window, wall.doubleL, wall.doubleR, wall.window],
    5: [wall.window, wall.window, wall.doubleL, wall.doubleR, wall.window],
  };
  rows.push(lower[Math.min(5, level)]);
  return rows;
}

/** Rows that block walking: the walls (the roof can be walked behind). */
export function wallRows(level: number): number {
  return level >= 4 ? 2 : 1;
}
