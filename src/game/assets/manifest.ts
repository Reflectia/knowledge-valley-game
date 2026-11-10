/**
 * Asset manifest: every texture the game loads, in one place.
 *
 * - `url` points to the prepared asset in public/assets/ (cut from the owner's
 *   new images by scripts/assets/*.py, or a temporary third-party pack).
 * - `fallback` is the design-system PNG with the same layout; it is loaded
 *   instead when the primary file is missing.
 * - `temp: true` marks third-party placeholders listed in ASSETS-TODO.md.
 */

// PNGs in images/, bundled by Vite: design-system fallbacks and the location tiles (images/biomes/).
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
  /** Frames per row (for drawing single frames in the UI). */
  columns: number;
  fallback?: string;
  temp?: boolean;
}

export interface JsonAsset {
  kind: 'json';
  url: string;
}

export interface MapAsset {
  kind: 'tilemap';
  url: string;
}

export type Asset = ImageAsset | SheetAsset | JsonAsset | MapAsset;

const img = (url: string, fallback?: string, temp = false): ImageAsset => ({ kind: 'image', url, fallback, temp });
const sheet = (
  url: string,
  frameWidth: number,
  frameHeight: number,
  columns: number,
  extra: Partial<Omit<SheetAsset, 'kind' | 'url' | 'frameWidth' | 'frameHeight' | 'columns'>> = {},
): SheetAsset => ({ kind: 'spritesheet', url, frameWidth, frameHeight, columns, ...extra });

export const ENEMIES = ['beetle', 'deadline', 'ghost', 'magpie', 'moth', 'slime', 'sprout', 'wisp'] as const;
export const ITEMS = ['book', 'potion', 'seed', 'staff'] as const;
export const TOOL_ICONS = ['sword', 'hoe', 'watering-can', 'axe', 'pickaxe'] as const;
export const BIOMES = ['forest', 'tower', 'market', 'forge', 'library'] as const;

/** Discipline buildings with the owner's art (scripts/assets/build_buildings.py); a pack without art uses temporary tiles. */
export const BUILDING_ART: readonly string[] = ['forest', 'tower', 'market', 'forge', 'library'];
export const buildingKey = (pack: string, level: number) => `building-${pack}-${level}`;

/** Furniture sprites of the house (images/interior/interior-objects-new.jpg). */
export const INTERIOR_OBJECTS = ['bed', 'desk', 'bookshelf', 'chest', 'fireplace', 'rug', 'doormat', 'fern', 'palm', 'lamp', 'table', 'clock'] as const;

export const MAPS = ['homestead', 'house', 'forest', 'tower', 'market', 'forge', 'library'] as const;
export type MapId = (typeof MAPS)[number];

export type EnemyId = (typeof ENEMIES)[number];
export type ItemId = (typeof ITEMS)[number];
export type BiomeId = (typeof BIOMES)[number];

export const ASSETS: Record<string, Asset> = {
  // Heroine: 4 walk frames × (down, up, right); left = mirrored right.
  heroine: sheet(pub('characters/heroine.png'), 16, 32, 4),
  'heroine-palettes': { kind: 'json', url: pub('characters/heroine-palettes.json') },

  ...Object.fromEntries(
    ENEMIES.map((id) => [`enemy-${id}`, img(pub(`enemies/${id}.png`), designPng(`enemies/${id}-16.png`))]),
  ),
  ...Object.fromEntries(
    ITEMS.map((id) => [`item-${id}`, img(pub(`items/${id}.png`), designPng(`items/${id}-16.png`))]),
  ),
  // Tools in the sword cursor's style (scripts/assets/build_tools.py); the sword is that cursor.
  ...Object.fromEntries(TOOL_ICONS.map((id) => [`item-${id}`, img(pub(`items/${id}.png`))])),
  ...Object.fromEntries(
    BIOMES.map((id) => [
      `portrait-${id}`,
      img(pub(`portraits/mentor-${id}.png`), designPng(`portraits/mentor-${id}-64.png`)),
    ]),
  ),
  emblem: img(pub('portraits/emblem.png')),
  // Mentors in the world, 16×32, drawn after the portraits (scripts/assets/build_mentors.py).
  ...Object.fromEntries(BIOMES.map((id) => [`mentor-${id}`, img(pub(`mentors/${id}.png`))])),

  // All tiles of the locations live in images/biomes/ (scripts/assets/build_biome_tiles.py,
  // homestead tiles: build_sprites.py homestead).
  ...Object.fromEntries(BIOMES.map((id) => [`tiles-${id}`, sheet(designPng(`biomes/${id}-tileset-16.png`), 16, 16, 5)])),
  'homestead-tiles': sheet(designPng('biomes/homestead-tiles-16.png'), 16, 16, 3),

  // Homestead, cut from homestead-day-night-new.jpg.
  'homestead-house': img(pub('homestead/house.png')),
  // Trading stall (images/buildings/shop-stall-new.jpg, scripts/assets/build_buildings.py stall).
  'shop-stall': img(pub('homestead/shop-stall.png')),
  'homestead-window-lit': img(pub('homestead/window-lit.png')),
  'tree-blossom-a': img(pub('homestead/tree-blossom-a.png')),
  'tree-blossom-b': img(pub('homestead/tree-blossom-b.png')),
  'lamp-post': img(pub('homestead/lamp-post.png')),
  'homestead-meta': { kind: 'json', url: pub('homestead/homestead.json') },

  // House interior (scripts/assets/build_interior.py): tiles and furniture sprites.
  'interior-tiles': sheet(pub('interior/interior-tiles.png'), 16, 16, 8),
  ...Object.fromEntries(INTERIOR_OBJECTS.map((id) => [`interior-${id}`, img(pub(`interior/${id}.png`))])),

  // Discipline buildings, levels 1..5, cut from images/buildings/building-<pack>-new.jpg.
  ...Object.fromEntries(
    BUILDING_ART.flatMap((pack) => [1, 2, 3, 4, 5].map((l) => [buildingKey(pack, l), img(pub(`buildings/${pack}-${l}.png`))])),
  ),

  // Temporary third-party placeholders (CC0). See ASSETS-TODO.md.
  'temp-crops': sheet(pub('_temp/josehzz-farming-crops/crops.png'), 16, 16, 12, { temp: true }),
  'temp-farm': sheet(pub('_temp/kenney-tiny-farm/tilemap.png'), 16, 16, 12, { temp: true }),
  'temp-town': sheet(pub('_temp/kenney-tiny-town/tilemap.png'), 16, 16, 12, { temp: true }),
  'temp-dungeon': sheet(pub('_temp/kenney-tiny-dungeon/tilemap.png'), 16, 16, 12, { temp: true }),
  // Self-drawn placeholder interior (scripts/assets/draw_interior.py).
  'temp-interior': sheet(pub('_temp/interior/interior-16.png'), 16, 16, 14, { temp: true }),
  mailbox: sheet(pub('_temp/interior/mailbox.png'), 16, 32, 2, { temp: true }),
  'wax-seal': img(designPng('ui/wax-seal-10.png')),

  // Tiled maps (scripts/maps/build-maps.mjs).
  ...Object.fromEntries(MAPS.map((id) => [`map-${id}`, { kind: 'tilemap', url: pub(`maps/${id}.json`) } as MapAsset])),
};

/** Tileset name inside the Tiled maps → texture key of its image. */
export const TILESET_TEXTURES: Record<string, string> = {
  homestead: 'homestead-tiles',
  town: 'temp-town',
  interior: 'temp-interior',
  house: 'interior-tiles',
  ...Object.fromEntries(BIOMES.map((id) => [id, `tiles-${id}`])),
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
  // temp-interior: garden soil, dry and watered
  soil: 12,
  soilWet: 13,
  // kenney-tiny-town: an empty building plot sign
  plotSign: 83,
} as const;
