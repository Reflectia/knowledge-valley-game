import { createGameStore } from '@/state/store';

import { brew, drink, findRecipe, knownRecipes, missing, POTIONS } from './alchemy';
import { ITEMS } from './items';
import { addItem, growNight, plant, till, water } from './homestead';
import { memoryStore, newLabs, newWorld, SaveStore, toSaveFile } from './save';
import { NO_EFFECTS } from './skills';
import { curriculum, discipline, lab } from './testing';
import type { WorldState } from './types';

const LIMITS = { maxEnergy: 100, maxHealth: 100, ceiling: 10 };
const withItems = (items: Record<string, number>, w: WorldState = newWorld()) =>
  Object.entries(items).reduce((acc, [id, n]) => addItem(acc, id, n), w);

describe('alchemy recipes', () => {
  it('every potion is an item and every ingredient exists', () => {
    for (const p of POTIONS) {
      expect(ITEMS[p.id]?.kind).toBe('potion');
      for (const id of Object.keys(p.recipe)) expect(ITEMS[id]).toBeDefined();
    }
  });

  it('knows the base recipes at once and the found ones later', () => {
    const base = knownRecipes(newWorld()).map((p) => p.id);
    expect(base).toEqual(['potion-energy', 'potion-health']);
    expect(knownRecipes({ ...newWorld(), recipes: ['potion-growth'] }).map((p) => p.id)).toContain('potion-growth');
  });

  it('brews from ingredients and refuses when something is missing', () => {
    const w = withItems({ turnip: 2, 'forest-moss': 1 });
    const r = brew(w, 'potion-energy');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.world.inventory['potion-energy']).toBe(1);
    expect(r.world.inventory.turnip).toBeUndefined();
    expect(brew(r.world, 'potion-energy')).toEqual({ ok: false, reason: 'noIngredients' });
    expect(missing(r.world, POTIONS[0])).toEqual({ turnip: 2, 'forest-moss': 1 });
    expect(brew(withItems({ potato: 1, 'forest-moss': 2 }), 'potion-growth')).toEqual({ ok: false, reason: 'unknownRecipe' });
  });
});

describe('drinking', () => {
  it('restores energy up to the maximum', () => {
    const w = withItems({ 'potion-energy': 1 }, { ...newWorld(), player: { ...newWorld().player, energy: 80 } });
    const r = drink(w, 'potion-energy', LIMITS);
    expect(r.ok && r.world.player.energy).toBe(100);
    expect(r.ok && r.world.inventory['potion-energy']).toBeUndefined();
  });

  it('a buff lasts until sleep and cannot be stacked', () => {
    const w = withItems({ 'potion-strength': 2 });
    const r = drink(w, 'potion-strength', LIMITS);
    expect(r.ok && r.world.buffs).toEqual(['strength']);
    if (!r.ok) return;
    expect(drink(r.world, 'potion-strength', LIMITS)).toEqual({ ok: false, reason: 'alreadyActive' });
  });

  it('the growth potion makes watered crops grow a day more tonight', () => {
    let w = newWorld();
    for (const step of [(x: WorldState) => till(x, '1,1'), (x: WorldState) => plant(x, '1,1', 'seed-turnip'), (x: WorldState) => water(x, '1,1')]) {
      const r = step(w);
      if (!r.ok) throw new Error(r.reason);
      w = r.world;
    }
    expect(growNight(w).plots['1,1'].growth).toBe(1);
    expect(growNight(w, { ...NO_EFFECTS, growthBonus: 1 }).plots['1,1'].growth).toBe(2);
  });
});

describe('recipes found in locations', () => {
  it('only the location recipe, only once, by chance', () => {
    expect(findRecipe(newWorld(), 'forest', () => 0)).toBe('potion-growth');
    expect(findRecipe(newWorld(), 'forest', () => 0.99)).toBeNull();
    expect(findRecipe({ ...newWorld(), recipes: ['potion-growth'] }, 'forest', () => 0)).toBeNull();
  });
});

describe('alchemy in the game store', () => {
  async function store(skills: string[]) {
    const saves = new SaveStore(memoryStore());
    const c = curriculum(
      [discipline(1, 'sci', 'library')],
      [1, 2, 3, 4, 5].map((n) => lab(1, 'sci', n, { doneDate: '2026-10-01' })),
    );
    const world = withItems({ turnip: 2, 'forest-moss': 1 }, newWorld('Ніка'));
    await saves.replace(toSaveFile({ ...newLabs(), curriculum: c, skills }, { state: world, ledger: {} }));
    const s = createGameStore(saves, () => new Date('2026-11-01T12:00:00'));
    await s.getState().init();
    return s;
  }

  it('brews only with the skill, costs energy, and buffs end at sleep', async () => {
    const without = await store([]);
    expect(without.getState().brew('potion-energy')).toBe('noAlchemy');
    const s = await store(['vigor', 'spark', 'alchemy']);
    const energy = s.getState().world.state.player.energy;
    expect(s.getState().brew('potion-energy')).toBeNull();
    expect(s.getState().world.state.inventory['potion-energy']).toBe(1);
    expect(s.getState().world.state.player.energy).toBeLessThan(energy);
    s.getState().editWorld((w) => addItem(w, 'potion-speed'));
    expect(s.getState().drink('potion-speed')).toBeNull();
    expect(s.getState().world.state.buffs).toEqual(['speed']);
    await s.getState().sleep();
    expect(s.getState().world.state.buffs).toEqual([]);
  });

  it('a defeated enemy may leave the location recipe', async () => {
    const s = await store(['vigor', 'spark', 'alchemy']);
    const loot = s.getState().defeatEnemy('sprout', () => 0, 'forest');
    expect(loot.recipe).toBe('potion-growth');
    expect(s.getState().world.state.recipes).toEqual(['potion-growth']);
  });
});
