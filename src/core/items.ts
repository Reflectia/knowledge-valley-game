/** Item, crop and shop catalog from src/content/items.json (content as data). */
import catalog from '../content/items.json';

export type ItemKind = 'tool' | 'seed' | 'crop' | 'resource' | 'furniture';
export type ToolKind = 'hoe' | 'water' | 'axe' | 'pickaxe' | 'sword' | 'staff' | 'bow';
export type Placement = 'indoor' | 'outdoor' | 'any';

export interface ItemIcon {
  sheet?: string;
  frame?: number;
  texture?: string;
}

export interface ItemDef {
  id: string;
  kind: ItemKind;
  name: string;
  text: string;
  icon: ItemIcon;
  /** Small second icon in the corner (seeds show their crop). */
  badge?: ItemIcon;
  tool?: ToolKind;
  crop?: string;
  /** Shop price (buy). */
  price?: number;
  /** Sell price per piece. */
  sell?: number;
  place?: Placement;
  collides?: boolean;
  /** Sold only after the Architecture skill «Креслення». */
  blueprint?: boolean;
  /** Exam trophy (stage 11): never sold or bought, only won. */
  trophy?: boolean;
}

export interface CropDef {
  id: string;
  harvest: string;
  /** Watered days until the crop is ripe. */
  days: number;
  /** First frame of the crop in the crops sheet (see items.json `_crops`). */
  firstFrame: number;
}

export const ITEMS: Record<string, ItemDef> = Object.fromEntries((catalog.items as ItemDef[]).map((i) => [i.id, i]));
export const CROPS: Record<string, CropDef> = Object.fromEntries((catalog.crops as CropDef[]).map((c) => [c.id, c]));
export const STARTER = catalog.starter as { coins: number; items: Record<string, number>; toolbar: (string | null)[] };
export const SHOP_BUY: string[] = catalog.shop.buy;

export const TOOLBAR_SIZE = 9;

export function getItem(id: string): ItemDef {
  const item = ITEMS[id];
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}

/** Things that are used up (seeds, furniture to place); tools stay. */
export function isConsumable(id: string): boolean {
  return ITEMS[id]?.kind !== 'tool';
}
