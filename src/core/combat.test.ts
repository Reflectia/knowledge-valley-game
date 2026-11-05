import { applyDefeat, applyLoot, ENEMY_DEFS, enemiesFor, rollLoot, weaponDamage } from './combat';
import { addItem, count } from './homestead';
import { ITEMS } from './items';
import { newWorld } from './save';
import { NO_EFFECTS } from './skills';
import { PACKS } from './content';

describe('enemies', () => {
  it('the study-humor trio appears everywhere, every location has its own creature', () => {
    for (const pack of Object.keys(PACKS)) {
      const list = enemiesFor(pack);
      for (const id of ['deadline', 'ghost', 'slime']) expect(list).toContain(id);
      expect(list.some((id) => !ENEMY_DEFS[id].everywhere)).toBe(true);
    }
  });

  it('loot items exist in the catalog', () => {
    for (const e of Object.values(ENEMY_DEFS)) for (const l of e.loot) expect(ITEMS[l.item]).toBeDefined();
  });

  it('rolls coins in range and items by chance', () => {
    const always = rollLoot('sprout', () => 0);
    expect(always.coins).toBe(ENEMY_DEFS.sprout.coins[0]);
    expect(always.items).toEqual(['forest-moss']);
    const never = rollLoot('sprout', () => 0.99);
    expect(never.coins).toBe(ENEMY_DEFS.sprout.coins[1]);
    expect(never.items).toEqual([]);
    const w = applyLoot(newWorld(), always);
    expect(w.player.coins).toBe(newWorld().player.coins + always.coins);
    expect(count(w, 'forest-moss')).toBe(1);
  });
});

describe('weapons', () => {
  it('«Кована зброя» makes the sword stronger, not the bow', () => {
    const fx = { ...NO_EFFECTS, swordBonus: 1 };
    expect(weaponDamage('sword', fx)).toBe(weaponDamage('sword', NO_EFFECTS) + 1);
    expect(weaponDamage('bow', fx)).toBe(weaponDamage('bow', NO_EFFECTS));
    expect(weaponDamage('hoe', fx)).toBe(0);
  });
});

describe('defeat (spec §4)', () => {
  it('loses part of coins and harvest/resources, keeps tools, seeds and furniture', () => {
    let w = newWorld();
    w = { ...w, player: { ...w.player, coins: 100 } };
    w = addItem(addItem(addItem(w, 'turnip', 8), 'wood', 3), 'rug', 1);
    const { world, lost } = applyDefeat(w);
    expect(lost.coins).toBe(20);
    expect(world.player.coins).toBe(80);
    expect(count(world, 'turnip')).toBe(6);
    expect(count(world, 'wood')).toBe(3); // 25 % of 3 rounds down to 0
    expect(count(world, 'hoe')).toBe(1);
    expect(count(world, 'seed-turnip')).toBe(count(w, 'seed-turnip'));
    expect(count(world, 'rug')).toBe(1);
    expect(lost.items).toEqual({ turnip: 2 });
  });
});
