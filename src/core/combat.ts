/**
 * Light combat (spec §4): enemies, weapons, the spark spell, loot and defeat.
 * Pure rules; the world scene does movement and collisions.
 */
import data from '../content/enemies.json';

import { addItem } from './homestead';
import { ITEMS } from './items';
import type { Effects } from './skills';
import type { WorldState } from './types';

export interface EnemyDef {
  name: string;
  text: string;
  hp: number;
  damage: number;
  speed: number;
  aggro: number;
  xp: number;
  coins: [number, number];
  loot: { item: string; chance: number }[];
  everywhere?: boolean;
  biomes?: string[];
}

export interface WeaponDef {
  damage: number;
  cooldown: number;
  range: number;
  kind: 'melee' | 'spark' | 'arrow';
  speed?: number;
}

export const ENEMY_DEFS = data.enemies as unknown as Record<string, EnemyDef>;
export const WEAPONS: Record<string, WeaponDef> = data.weapons as Record<string, WeaponDef>;
export const SPELL = data.spell;
export const SPAWN = data.spawn;
export const DEFEAT = data.defeat;
export const PLAYER_COMBAT = data.player;

/** Enemies that can appear in a location of this pack. */
export function enemiesFor(pack: string): string[] {
  return Object.entries(ENEMY_DEFS)
    .filter(([, e]) => e.everywhere || e.biomes?.includes(pack))
    .map(([id]) => id)
    .sort();
}

/** Damage of a weapon hit, with skills (Architecture «Кована зброя» for the sword). */
export function weaponDamage(tool: string, fx: Effects): number {
  const w = WEAPONS[tool];
  if (!w) return 0;
  return w.damage + (tool === 'sword' ? fx.swordBonus : 0);
}

export type Rng = () => number;

/** Loot for a defeated enemy: coins in range and items by chance. */
export function rollLoot(enemy: string, rng: Rng): { coins: number; items: string[] } {
  const e = ENEMY_DEFS[enemy];
  const [lo, hi] = e.coins;
  const coins = lo + Math.floor(rng() * (hi - lo + 1));
  const items = e.loot.filter((l) => rng() < l.chance && ITEMS[l.item]).map((l) => l.item);
  return { coins, items };
}

export function applyLoot(w: WorldState, loot: { coins: number; items: string[] }): WorldState {
  let next: WorldState = { ...w, player: { ...w.player, coins: w.player.coins + loot.coins } };
  for (const item of loot.items) next = addItem(next, item);
  return next;
}

export interface DefeatLoss {
  coins: number;
  items: Record<string, number>;
}

/**
 * Defeat (spec §4): the heroine is carried home and loses part of her resources —
 * a share of coins and of each harvest/resource stack. Tools, seeds and furniture stay.
 */
export function applyDefeat(w: WorldState): { world: WorldState; lost: DefeatLoss } {
  const coins = Math.floor(w.player.coins * DEFEAT.coinsLost);
  const inventory = { ...w.inventory };
  const items: Record<string, number> = {};
  for (const [id, n] of Object.entries(w.inventory)) {
    if (!DEFEAT.kinds.includes(ITEMS[id]?.kind ?? '')) continue;
    const lose = Math.floor(n * DEFEAT.stackLost);
    if (lose <= 0) continue;
    items[id] = lose;
    if (n - lose > 0) inventory[id] = n - lose;
    else delete inventory[id];
  }
  const toolbar = w.toolbar.map((t) => (t && !inventory[t] ? null : t));
  return {
    world: { ...w, inventory, toolbar, player: { ...w.player, coins: w.player.coins - coins } },
    lost: { coins, items },
  };
}
