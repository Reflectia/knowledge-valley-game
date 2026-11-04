/**
 * Garden, inventory, shop and decor rules (spec §4: farming and furnishing).
 * Pure functions on WorldState; every function returns a new state or an error code.
 */
import { CROPS, getItem, isConsumable, ITEMS, TOOLBAR_SIZE } from './items';
import type { Placed, Plot, WorldState } from './types';

export type Fail<C extends string> = { ok: false; reason: C };
export type Ok<T = WorldState> = { ok: true; world: T };

const ok = (world: WorldState): Ok => ({ ok: true, world });
const fail = <C extends string>(reason: C): Fail<C> => ({ ok: false, reason });

// ------------------------------------------------------------------ inventory

export function count(w: WorldState, id: string): number {
  return w.inventory[id] ?? 0;
}

export function addItem(w: WorldState, id: string, n = 1): WorldState {
  getItem(id);
  const inventory = { ...w.inventory, [id]: count(w, id) + n };
  // New items find a free toolbar slot, like picking something up in Stardew Valley.
  let toolbar = w.toolbar;
  if (!toolbar.includes(id)) {
    const free = toolbar.indexOf(null);
    if (free >= 0) toolbar = toolbar.map((t, i) => (i === free ? id : t));
  }
  return { ...w, inventory, toolbar };
}

export function removeItem(w: WorldState, id: string, n = 1): WorldState | null {
  const have = count(w, id);
  if (have < n) return null;
  const inventory = { ...w.inventory };
  if (have === n) delete inventory[id];
  else inventory[id] = have - n;
  // Used-up items leave the toolbar.
  const toolbar = have === n && isConsumable(id) ? w.toolbar.map((t) => (t === id ? null : t)) : w.toolbar;
  return { ...w, inventory, toolbar };
}

/** Put an owned item on a toolbar slot (it moves if it was on another slot). */
export function setToolbarSlot(w: WorldState, slot: number, id: string | null): WorldState {
  if (slot < 0 || slot >= TOOLBAR_SIZE) return w;
  if (id && count(w, id) === 0) return w;
  const toolbar = w.toolbar.map((t) => (t === id ? null : t));
  toolbar[slot] = id;
  return { ...w, toolbar };
}

// ------------------------------------------------------------------ garden

/** Growth stage 0 (seeds) … 4 (ripe). */
export function cropStage(plot: Plot): number {
  if (!plot.crop) return -1;
  const days = CROPS[plot.crop].days;
  if (plot.growth >= days) return 4;
  return Math.min(3, Math.floor((plot.growth * 4) / days));
}

export function isRipe(plot: Plot): boolean {
  return cropStage(plot) === 4;
}

/** Frame in the crops sheet for this plot's crop (seeds +5 → ripe +1). */
export function cropFrame(plot: Plot): number | null {
  if (!plot.crop) return null;
  return CROPS[plot.crop].firstFrame + 5 - cropStage(plot);
}

export function till(w: WorldState, key: string) {
  if (w.plots[key]) return fail('alreadyTilled');
  return ok({ ...w, plots: { ...w.plots, [key]: { growth: 0, wateredToday: false } } });
}

export function plant(w: WorldState, key: string, seedId: string) {
  const plot = w.plots[key];
  if (!plot) return fail('notTilled');
  if (plot.crop) return fail('occupied');
  const seed = ITEMS[seedId];
  if (!seed?.crop) return fail('notSeed');
  const after = removeItem(w, seedId);
  if (!after) return fail('noSeeds');
  return ok({ ...after, plots: { ...after.plots, [key]: { ...plot, crop: seed.crop, growth: 0 } } });
}

export function water(w: WorldState, key: string) {
  const plot = w.plots[key];
  if (!plot) return fail('notTilled');
  if (plot.wateredToday) return fail('alreadyWatered');
  return ok({ ...w, plots: { ...w.plots, [key]: { ...plot, wateredToday: true } } });
}

export function harvest(w: WorldState, key: string) {
  const plot = w.plots[key];
  if (!plot?.crop) return fail('empty');
  if (!isRipe(plot)) return fail('notRipe');
  const item = CROPS[plot.crop].harvest;
  const after = addItem(w, item);
  const plots: Record<string, Plot> = { ...after.plots, [key]: { growth: 0, wateredToday: plot.wateredToday } };
  return { ok: true as const, world: { ...after, plots }, item };
}

/** Night: watered crops grow one day; all soil dries. */
export function growNight(w: WorldState): WorldState {
  const plots: Record<string, Plot> = {};
  for (const [key, p] of Object.entries(w.plots)) {
    const grows = p.crop && p.wateredToday && !isRipe(p);
    plots[key] = { ...p, growth: grows ? p.growth + 1 : p.growth, wateredToday: false };
  }
  return { ...w, plots };
}

// ------------------------------------------------------------------ shop

export function buy(w: WorldState, id: string, qty = 1, discount = 0) {
  const item = getItem(id);
  if (!item.price) return fail('notForSale');
  const cost = Math.ceil(item.price * (1 - discount)) * qty;
  if (w.player.coins < cost) return fail('noCoins');
  const paid = { ...w, player: { ...w.player, coins: w.player.coins - cost } };
  return ok(addItem(paid, id, qty));
}

export function sell(w: WorldState, id: string, qty = 1) {
  const item = getItem(id);
  if (!item.sell) return fail('notSellable');
  const after = removeItem(w, id, qty);
  if (!after) return fail('notEnough');
  return ok({ ...after, player: { ...after.player, coins: after.player.coins + item.sell * qty } });
}

// ------------------------------------------------------------------ decor

export function decorAt(w: WorldState, map: string, x: number, y: number): Placed | undefined {
  return w.decor.find((d) => d.map === map && d.x === x && d.y === y);
}

export function placeDecor(w: WorldState, id: string, map: string, x: number, y: number, indoor: boolean) {
  const item = ITEMS[id];
  if (!item || item.kind !== 'furniture') return fail('notFurniture');
  if (item.place === 'indoor' && !indoor) return fail('indoorOnly');
  if (item.place === 'outdoor' && indoor) return fail('outdoorOnly');
  if (decorAt(w, map, x, y)) return fail('occupied');
  const after = removeItem(w, id);
  if (!after) return fail('notEnough');
  const uid = w.decor.reduce((m, d) => Math.max(m, d.uid), 0) + 1;
  return ok({ ...after, decor: [...after.decor, { uid, item: id, map, x, y }] });
}

export function pickUpDecor(w: WorldState, uid: number) {
  const d = w.decor.find((x) => x.uid === uid);
  if (!d) return fail('missing');
  return ok(addItem({ ...w, decor: w.decor.filter((x) => x.uid !== uid) }, d.item));
}
