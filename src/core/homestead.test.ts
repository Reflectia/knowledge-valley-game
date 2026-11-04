import {
  addItem,
  buy,
  count,
  cropFrame,
  cropStage,
  growNight,
  harvest,
  isRipe,
  pickUpDecor,
  placeDecor,
  plant,
  removeItem,
  sell,
  setToolbarSlot,
  till,
  water,
} from './homestead';
import { CROPS, ITEMS, STARTER } from './items';
import { newWorld } from './save';
import type { WorldState } from './types';

const K = '30,10';
const unwrap = (r: { ok: boolean; world?: WorldState; reason?: string }) => {
  if (!r.ok) throw new Error(`failed: ${r.reason}`);
  return r.world!;
};

describe('starter kit', () => {
  it('a new world has tools, seeds, coins and a filled toolbar', () => {
    const w = newWorld();
    expect(count(w, 'hoe')).toBe(1);
    expect(count(w, 'seed-turnip')).toBe(STARTER.items['seed-turnip']);
    expect(w.player.coins).toBe(STARTER.coins);
    expect(w.toolbar).toHaveLength(9);
    expect(w.toolbar[0]).toBe('hoe');
  });

  it('every icon, crop and toolbar entry points at real data', () => {
    for (const c of Object.values(CROPS)) expect(ITEMS[c.harvest]).toBeDefined();
    for (const i of Object.values(ITEMS)) if (i.crop) expect(CROPS[i.crop]).toBeDefined();
    for (const t of STARTER.toolbar) if (t) expect(ITEMS[t]).toBeDefined();
  });
});

describe('garden: till → plant → water → grow at night → harvest', () => {
  it('grows only on watered days and gives the crop when ripe', () => {
    let w = unwrap(till(newWorld(), K));
    w = unwrap(plant(w, K, 'seed-turnip'));
    expect(count(w, 'seed-turnip')).toBe(STARTER.items['seed-turnip'] - 1);
    expect(cropStage(w.plots[K])).toBe(0);

    // A dry night: no growth.
    w = growNight(w);
    expect(w.plots[K].growth).toBe(0);

    for (let day = 0; day < CROPS.turnip.days; day++) {
      w = unwrap(water(w, K));
      expect(water(w, K)).toEqual({ ok: false, reason: 'alreadyWatered' });
      w = growNight(w);
      expect(w.plots[K].wateredToday).toBe(false);
    }
    expect(isRipe(w.plots[K])).toBe(true);
    expect(cropFrame(w.plots[K])).toBe(CROPS.turnip.firstFrame + 1);

    const h = harvest(w, K);
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.item).toBe('turnip');
    expect(count(h.world, 'turnip')).toBe(1);
    expect(h.world.plots[K]).toMatchObject({ growth: 0 }); // soil stays tilled
    expect(h.world.plots[K].crop).toBeUndefined();
  });

  it('shows the growth stages from seeds to ripe', () => {
    const plot = { crop: 'tomato', growth: 0, wateredToday: false };
    const stages = [0, 2, 4, 6, 8].map((g) => cropStage({ ...plot, growth: g }));
    expect(stages).toEqual([0, 1, 2, 3, 4]);
  });

  it('refuses the wrong actions', () => {
    const w = newWorld();
    expect(plant(w, K, 'seed-turnip')).toEqual({ ok: false, reason: 'notTilled' });
    const t = unwrap(till(w, K));
    expect(till(t, K)).toEqual({ ok: false, reason: 'alreadyTilled' });
    expect(plant(t, K, 'hoe')).toEqual({ ok: false, reason: 'notSeed' });
    expect(plant(t, K, 'seed-tomato')).toEqual({ ok: false, reason: 'noSeeds' });
    const p = unwrap(plant(t, K, 'seed-turnip'));
    expect(plant(p, K, 'seed-turnip')).toEqual({ ok: false, reason: 'occupied' });
    expect(harvest(p, K)).toEqual({ ok: false, reason: 'notRipe' });
  });
});

describe('inventory and toolbar', () => {
  it('used-up seeds leave the toolbar, tools stay', () => {
    let w = newWorld();
    const n = count(w, 'seed-potato');
    w = removeItem(w, 'seed-potato', n)!;
    expect(w.toolbar).not.toContain('seed-potato');
    expect(removeItem(w, 'seed-potato')).toBeNull();
  });

  it('new items take a free toolbar slot; slots can be reassigned', () => {
    let w = addItem(newWorld(), 'turnip', 2);
    expect(w.toolbar).toContain('turnip');
    w = setToolbarSlot(w, 0, 'turnip');
    expect(w.toolbar[0]).toBe('turnip');
    expect(w.toolbar.filter((t) => t === 'turnip')).toHaveLength(1);
    expect(setToolbarSlot(w, 1, 'tomato').toolbar[1]).toBe(w.toolbar[1]); // not owned
  });
});

describe('shop', () => {
  it('buys with coins and sells crops', () => {
    let w = newWorld();
    w = unwrap(buy(w, 'seed-turnip', 2));
    expect(w.player.coins).toBe(STARTER.coins - 2 * ITEMS['seed-turnip'].price!);
    expect(buy(w, 'bookshelf')).toEqual({ ok: false, reason: 'noCoins' });
    w = addItem(w, 'tomato', 3);
    const before = w.player.coins;
    w = unwrap(sell(w, 'tomato', 3));
    expect(w.player.coins).toBe(before + 3 * ITEMS.tomato.sell!);
    expect(sell(w, 'hoe')).toEqual({ ok: false, reason: 'notSellable' });
  });

  it('applies a discount and rounds up', () => {
    const w = unwrap(buy(newWorld(), 'seed-turnip', 1, 0.15));
    expect(w.player.coins).toBe(STARTER.coins - Math.ceil(ITEMS['seed-turnip'].price! * 0.85));
  });
});

describe('decor', () => {
  it('places furniture indoors and picks it up again', () => {
    let w = addItem(newWorld(), 'rug');
    w = unwrap(placeDecor(w, 'rug', 'house', 4, 4, true));
    expect(count(w, 'rug')).toBe(0);
    expect(w.decor).toEqual([{ uid: 1, item: 'rug', map: 'house', x: 4, y: 4 }]);
    expect(placeDecor(addItem(w, 'rug'), 'rug', 'house', 4, 4, true)).toEqual({ ok: false, reason: 'occupied' });
    w = unwrap(pickUpDecor(w, 1));
    expect(w.decor).toEqual([]);
    expect(count(w, 'rug')).toBe(1);
  });

  it('keeps indoor things indoors and fences outdoors', () => {
    const w = addItem(addItem(newWorld(), 'rug'), 'fence');
    expect(placeDecor(w, 'rug', 'homestead', 1, 1, false)).toEqual({ ok: false, reason: 'indoorOnly' });
    expect(placeDecor(w, 'fence', 'house', 1, 1, true)).toEqual({ ok: false, reason: 'outdoorOnly' });
    expect(placeDecor(w, 'hoe', 'house', 1, 1, true)).toEqual({ ok: false, reason: 'notFurniture' });
  });
});
