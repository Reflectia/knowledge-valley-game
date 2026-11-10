/**
 * Alchemy (spec §5: the Science branch «Алхімія: зілля, нові рецепти, заклинання»; spec §4:
 * exploring locations gives recipes). With the skill «Алхімія», the «Алхімічна лабораторія» on the
 * homestead brews potions from crops and location resources. Two recipes are known at once; each
 * location hides one more, found with a chance when an enemy there is defeated.
 * A potion works at once (energy, health, experience) or until sleep (a buff).
 * Pure rules; the recipes are content (src/content/alchemy.json).
 */
import data from '../content/alchemy.json';

import { addItem, count } from './homestead';
import { gainXp } from './rules';
import type { WorldState } from './types';

export type Buff = 'growth' | 'strength' | 'speed' | 'star';

export interface PotionDef {
  /** The potion's item id. */
  id: string;
  /** Known as soon as alchemy is learned. */
  base?: boolean;
  /** Found in this pack's location. */
  pack?: string;
  effect: { energy?: number; health?: number; xp?: number; buff?: Buff };
  /** Ingredient item id → count. */
  recipe: Record<string, number>;
}

export const POTIONS = data.potions as unknown as PotionDef[];
export const BUFFS = data.buffs as Record<Buff, { name: string; text: string }>;
export const FIND_CHANCE = data.findChance;

export function potion(id: string): PotionDef | undefined {
  return POTIONS.find((p) => p.id === id);
}

/** Recipes the heroine can brew: the base ones plus those found in locations. */
export function knownRecipes(w: WorldState): PotionDef[] {
  const found = new Set(w.recipes ?? []);
  return POTIONS.filter((p) => p.base || found.has(p.id));
}

export function missing(w: WorldState, p: PotionDef): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(p.recipe)) {
    const lack = n - count(w, id);
    if (lack > 0) out[id] = lack;
  }
  return out;
}

export type BrewResult = { ok: true; world: WorldState } | { ok: false; reason: string };

/** Use up the ingredients and put the potion in the bag. */
export function brew(w: WorldState, id: string): BrewResult {
  const p = potion(id);
  if (!p || !knownRecipes(w).includes(p)) return { ok: false, reason: 'unknownRecipe' };
  if (Object.keys(missing(w, p)).length > 0) return { ok: false, reason: 'noIngredients' };
  const inventory = { ...w.inventory };
  for (const [item, n] of Object.entries(p.recipe)) {
    inventory[item] -= n;
    if (inventory[item] <= 0) delete inventory[item];
  }
  const toolbar = w.toolbar.map((t) => (t && !inventory[t] ? null : t));
  return { ok: true, world: addItem({ ...w, inventory, toolbar }, id) };
}

export interface DrinkLimits {
  maxEnergy: number;
  maxHealth: number;
  ceiling: number;
}

/** Drink a potion from the bag: its effect now, or a buff until sleep. */
export function drink(w: WorldState, id: string, limits: DrinkLimits): BrewResult {
  const p = potion(id);
  if (!p || count(w, id) < 1) return { ok: false, reason: 'noPotion' };
  const e = p.effect;
  if (e.buff && (w.buffs ?? []).includes(e.buff)) return { ok: false, reason: 'alreadyActive' };
  const inventory = { ...w.inventory, [id]: w.inventory[id] - 1 };
  if (inventory[id] <= 0) delete inventory[id];
  const toolbar = w.toolbar.map((t) => (t && !inventory[t] ? null : t));
  let player = { ...w.player };
  if (e.energy) player.energy = Math.min(limits.maxEnergy, player.energy + e.energy);
  if (e.health) player.health = Math.min(limits.maxHealth, player.health + e.health);
  if (e.xp) player = gainXp(player, e.xp, limits.ceiling);
  const buffs = e.buff ? [...(w.buffs ?? []), e.buff] : w.buffs;
  return { ok: true, world: { ...w, inventory, toolbar, player, ...(buffs ? { buffs } : {}) } };
}

export function hasBuff(w: WorldState, b: Buff): boolean {
  return (w.buffs ?? []).includes(b);
}

/**
 * A defeated enemy in a location may leave that location's recipe (once alchemy is known).
 * Returns the newly found recipe's potion id, or null.
 */
export function findRecipe(w: WorldState, pack: string, rng: () => number): string | null {
  const p = POTIONS.find((x) => x.pack === pack);
  if (!p || (w.recipes ?? []).includes(p.id) || rng() >= FIND_CHANCE) return null;
  return p.id;
}
