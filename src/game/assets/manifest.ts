/**
 * Asset manifest: every texture the game loads, in one place.
 *
 * - `url` points to the prepared asset in public/assets/ (cut from the owner's
 *   new images by scripts/assets/*.py, or a temporary third-party pack).
 * - `fallback` is the design-system PNG with the same layout; it is loaded
 *   instead when the primary file is missing.
 * - `temp: true` marks third-party placeholders listed in ASSETS-TODO.md.
 */

// Design-system PNGs (images/), bundled by Vite and used as fallbacks.
// images/previews/ is for viewing only and must never reach the game.
const designPngs = import.meta.glob<string>(['../../../images/**/*.png', '!../../../images/previews/**'], {
  eager: true,
  query: '?url',
  import: 'default',
});

function designPng(path: string): string {
  const url = designPngs[`../../../images/${path}`];
  if (!url) throw new Error(`Design-system PNG not found: images/${path}`);
  return url;
}

/** public/ is served at the base path; keep URLs relative for GitHub Pages. */
const pub = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`;

export interface ImageAsset {
  kind: 'image';
  url: string;
  fallback?: string;
  temp?: boolean;
}

export interface SheetAsset {
  kind: 'spritesheet';
  url: string;
  frameWidth: number;
  frameHeight: number;
  /** Gap between frames in the source sheet (Kenney sheets with 1 px spacing). */
  spacing?: number;
  fallback?: string;
  temp?: boolean;
}

export interface JsonAsset {
  kind: 'json';
  url: string;
}

export type Asset = ImageAsset | SheetAsset | JsonAsset;

const img = (url: string, fallback?: string, temp = false): ImageAsset => ({ kind: 'image', url, fallback, temp });
const sheet = (
  url: string,
  frameWidth: number,
  frameHeight: number,
  extra: Partial<Omit<SheetAsset, 'kind' | 'url' | 'frameWidth' | 'frameHeight'>> = {},
): SheetAsset => ({ kind: 'spritesheet', url, frameWidth, frameHeight, ...extra });

export const ENEMIES = ['beetle', 'deadline', 'ghost', 'magpie', 'moth', 'slime', 'sprout', 'wisp'] as const;
export const ITEMS = ['book', 'potion', 'seed', 'staff'] as const;
export const BIOMES = ['forest', 'tower', 'market', 'forge', 'library'] as const;

export type EnemyId = (typeof ENEMIES)[number];
export type ItemId = (typeof ITEMS)[number];
export type BiomeId = (typeof BIOMES)[number];

export const ASSETS: Record<string, Asset> = {
  // Heroine: 4 walk frames × (down, up, right); left = mirrored right.
  heroine: sheet(pub('characters/heroine.png'), 16, 32),
  'heroine-palettes': { kind: 'json', url: pub('characters/heroine-palettes.json') },

  ...Object.fromEntries(
    ENEMIES.map((id) => [`enemy-${id}`, img(pub(`enemies/${id}.png`), designPng(`enemies/${id}-16.png`))]),
  ),
  ...Object.fromEntries(
    ITEMS.map((id) => [`item-${id}`, img(pub(`items/${id}.png`), designPng(`items/${id}-16.png`))]),
  ),
  ...Object.fromEntries(
    BIOMES.map((id) => [
      `portrait-${id}`,
      img(pub(`portraits/mentor-${id}.png`), designPng(`portraits/mentor-${id}-64.png`)),
    ]),
  ),
  emblem: img(pub('portraits/emblem.png')),

  // Biome tiles stay from the design system (the new biome images are previews only).
  ...Object.fromEntries(BIOMES.map((id) => [`tiles-${id}`, sheet(designPng(`tiles/${id}-tileset-16.png`), 16, 16)])),

  // Homestead, cut from homestead-day-night-new.jpg.
  'homestead-tiles': sheet(pub('homestead/homestead-tiles-16.png'), 16, 16),
  'homestead-house': img(pub('homestead/house.png')),
  'homestead-window-lit': img(pub('homestead/window-lit.png')),
  'tree-blossom-a': img(pub('homestead/tree-blossom-a.png')),
  'tree-blossom-b': img(pub('homestead/tree-blossom-b.png')),
  'lamp-post': img(pub('homestead/lamp-post.png')),
  'homestead-meta': { kind: 'json', url: pub('homestead/homestead.json') },

  // Temporary third-party placeholders (CC0). See ASSETS-TODO.md.
  'temp-crops': sheet(pub('_temp/josehzz-farming-crops/crops.png'), 16, 16, { temp: true }),
  'temp-farm': sheet(pub('_temp/kenney-tiny-farm/tilemap.png'), 16, 16, { temp: true }),
  'temp-town': sheet(pub('_temp/kenney-tiny-town/tilemap.png'), 16, 16, { temp: true }),
  'temp-dungeon': sheet(pub('_temp/kenney-tiny-dungeon/tilemap.png'), 16, 16, { temp: true }),
  'temp-indoor': sheet(pub('_temp/kenney-roguelike-indoor/spritesheet.png'), 16, 16, { spacing: 1, temp: true }),
};

/** Frame indices inside temporary sheets, by game use. Mirrors ASSETS-TODO.md. */
export const TEMP_FRAMES = {
  // kenney-tiny-farm (12 columns)
  soilBed: 0,
  wateringCan: 84,
  hoe: 88,
  axe: 87,
  // kenney-tiny-town
  pickaxe: 115,
  bow: 118,
  fence: { h: 81, v: 47 },
  // kenney-tiny-dungeon
  sword: 104,
  // josehzz-farming-crops: 12 columns, 2 crops per row, 6 frames per crop:
  // frame 0 = harvested item, frames 5..1 = growth stages (seed → mature).
  cropColumns: 12,
} as const;
