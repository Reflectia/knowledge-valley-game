import { createGameStore } from '@/state/store';

import { BALANCE } from './content';
import { memoryStore, migrate, newLabs, newWorld, parseSaveFile, SaveError, SaveStore, SAVE_VERSION, toSaveFile } from './save';
import { sampleCurriculum } from './testing';

const R = BALANCE.rewards;
const NOW = () => new Date('2026-11-04T12:00:00Z');
const START = newWorld().player.coins;

describe('save file format', () => {
  it('round-trips through JSON', () => {
    const file = toSaveFile(newLabs(), { state: newWorld('Надійка'), ledger: {} });
    expect(parseSaveFile(JSON.stringify(file))).toEqual(file);
  });

  it('runs migrations step by step up to the current version', () => {
    const migrations = {
      1: (s: Record<string, unknown>) => ({ ...s, version: 2, note: 'v2' }),
      2: (s: Record<string, unknown>) => ({ ...s, version: 3, note: `${s.note}+v3` }),
    };
    const v1 = { ...toSaveFile(newLabs(), { state: newWorld(), ledger: {} }), version: 1 };
    const out = migrate(v1, migrations, 3) as unknown as { version: number; note: string };
    expect(out.version).toBe(3);
    expect(out.note).toBe('v2+v3');
  });

  it('migrates a version-1 save: keeps progress, adds the starter kit and toolbar', () => {
    const v1 = {
      game: 'knowledge-valley',
      version: 1,
      savedAt: '2026-11-01T10:00:00.000Z',
      labs: newLabs(),
      world: {
        state: { day: 5, player: { ...newWorld('Ніка').player, coins: 230 }, inventory: { 'forest-moss': 3 } },
        ledger: {},
      },
    };
    const file = migrate(v1);
    expect(file.version).toBe(SAVE_VERSION);
    expect(file.world.state.day).toBe(5);
    expect(file.world.state.player.coins).toBe(230);
    expect(file.world.state.inventory['forest-moss']).toBe(3);
    expect(file.world.state.inventory.hoe).toBe(1);
    expect(file.world.state.toolbar).toHaveLength(9);
    expect(file.world.state.plots).toEqual({});
    expect(file.world.state.decor).toEqual([]);
  });

  it('gives readable errors for bad files', () => {
    expect(() => parseSaveFile('{oops')).toThrow(SaveError);
    expect(() => parseSaveFile('{"game":"other","version":1}')).toThrow(/this game/);
    expect(() => parseSaveFile(JSON.stringify({ game: 'knowledge-valley', version: SAVE_VERSION + 1 }))).toThrow(
      /newer/,
    );
    expect(() => parseSaveFile(JSON.stringify({ game: 'knowledge-valley', version: 1 }))).toThrow(/incomplete/);
  });
});

describe('game store with storage', () => {
  async function started(kv = memoryStore()) {
    const store = createGameStore(new SaveStore(kv), NOW);
    await store.getState().init();
    return { store, kv };
  }

  it('starts without a save, then a new game is saved', async () => {
    const { store, kv } = await started();
    expect(store.getState().hasSave).toBe(false);
    await store.getState().newGame('Надійка', { hair: 'red', skin: 'light', shirt: 'green' });
    const again = await started(kv);
    expect(again.store.getState().hasSave).toBe(true);
    expect(again.store.getState().world.state.player.name).toBe('Надійка');
  });

  it('closing the tab mid-day keeps lab data and pays its rewards exactly once', async () => {
    const { store, kv } = await started();
    await store.getState().newGame('Н', { hair: 'red', skin: 'light', shirt: 'green' });
    await store.getState().setCurriculum(sampleCurriculum());
    await store.getState().markLabDone('1:mpm_ai:1', '2026-09-23');
    expect(store.getState().world.state.player.coins).toBe(START + R.done.coins + R.onTime.coins);

    // No sleep: the world was not saved, the labs were.
    const reopened = (await started(kv)).store;
    const s = reopened.getState();
    expect(s.labs.curriculum.labs['1:mpm_ai:1'].doneDate).toBe('2026-09-23');
    expect(s.world.state.player.coins).toBe(START + R.done.coins + R.onTime.coins);
    expect(s.progress.ceiling).toBe(BALANCE.ceiling.base + BALANCE.ceiling.perLab);

    // After sleeping and reopening, nothing is paid again.
    await reopened.getState().sleep();
    const third = (await started(kv)).store.getState();
    expect(third.world.state.player.coins).toBe(START + R.done.coins + R.onTime.coins);
    expect(third.world.state.day).toBe(2);
    expect(third.pendingRewards).toEqual([]);
  });

  it('export then import restores the game completely', async () => {
    const { store } = await started();
    await store.getState().newGame('Н', { hair: 'red', skin: 'light', shirt: 'green' });
    await store.getState().setCurriculum(sampleCurriculum());
    await store.getState().markLabDone('1:mpm_ai:1', '2026-09-23');
    await store.getState().setLabScore('1:mpm_ai:1', 8);
    store.getState().addXp(15);
    const json = store.getState().exportSave();

    const other = (await started()).store;
    await other.getState().importSave(json);
    const a = store.getState();
    const b = other.getState();
    expect(b.labs).toEqual(a.labs);
    expect(b.world).toEqual(a.world);
    expect(b.progress).toEqual(a.progress);
    expect(b.labs.settings.lastExportAt).toBe(NOW().toISOString());
  });

  it('queues reward events for the reward scene and hands them out once', async () => {
    const { store } = await started();
    await store.getState().setCurriculum(sampleCurriculum());
    await store.getState().markLabDone('1:mpm_ai:1', '2026-09-23');
    expect(store.getState().takeRewards()).toHaveLength(1);
    expect(store.getState().takeRewards()).toEqual([]);
  });

  it('reports storage errors without losing lab data in memory', async () => {
    const broken = memoryStore();
    broken.set = async () => {
      throw new Error('quota exceeded');
    };
    const { store } = await started(broken);
    await store.getState().setCurriculum(sampleCurriculum());
    expect(store.getState().saveError).toBe('quota exceeded');
    expect(Object.keys(store.getState().labs.curriculum.labs)).toHaveLength(9);
  });

  it('does not show a taken reward again after a reload, but keeps paying it', async () => {
    const { store, kv } = await started();
    await store.getState().newGame('Н', { hair: 'red', skin: 'light', shirt: 'green' });
    await store.getState().setCurriculum(sampleCurriculum());
    await store.getState().markLabDone('1:mpm_ai:1', '2026-09-23');
    expect(store.getState().takeRewards()).toHaveLength(1);
    const reopened = (await started(kv)).store.getState();
    expect(reopened.pendingRewards).toEqual([]);
    expect(reopened.world.state.player.coins).toBe(START + R.done.coins + R.onTime.coins);
  });

  it('shows the scene again when a lab is undone and done again', async () => {
    const { store } = await started();
    await store.getState().setCurriculum(sampleCurriculum());
    await store.getState().markLabDone('1:mpm_ai:1', '2026-09-23');
    store.getState().takeRewards();
    await store.getState().unmarkLab('1:mpm_ai:1');
    await store.getState().markLabDone('1:mpm_ai:1', '2026-09-24');
    expect(store.getState().pendingRewards.map((e) => e.kind)).toEqual(['done']);
  });

  it('new rarity thresholds re-grade items silently', async () => {
    const { store, kv } = await started();
    await store.getState().setCurriculum(sampleCurriculum());
    await store.getState().markLabDone('1:mpm_ai:1', '2026-09-23');
    await store.getState().setLabScore('1:mpm_ai:1', 8);
    store.getState().takeRewards();
    expect(store.getState().progress.uniques[0].rarity).toBe('epic');
    await store.getState().updateSettings({ rarityThresholds: { rare: 0.5, epic: 0.6, legendary: 0.8 } });
    expect(store.getState().progress.uniques[0].rarity).toBe('legendary');
    expect(store.getState().pendingRewards).toEqual([]);
    expect((await started(kv)).store.getState().pendingRewards).toEqual([]);
  });
});

describe('day, energy and sleep', () => {
  async function playing() {
    const store = createGameStore(new SaveStore(memoryStore()), NOW);
    await store.getState().init();
    await store.getState().newGame('Н', { hair: 'red', skin: 'light', shirt: 'green' });
    store.getState().beginSession();
    store.getState().setUiBlocking(false);
    return store;
  }

  it('the clock runs only while no window is open', async () => {
    const store = await playing();
    const start = store.getState().clockMinutes;
    store.getState().tickClock(10_000);
    const after = store.getState().clockMinutes;
    expect(after).toBeGreaterThan(start);
    store.getState().setUiBlocking(true);
    store.getState().tickClock(10_000);
    expect(store.getState().clockMinutes).toBe(after);
  });

  it('at 02:00 the day ends; sleeping starts the next morning at home and saves', async () => {
    const store = await playing();
    store.getState().tickClock(20 * 60_000);
    expect(store.getState().sleepRequest).toBe('late');
    const epoch = store.getState().worldEpoch;
    await store.getState().sleep();
    const s = store.getState();
    expect(s.world.state.day).toBe(2);
    expect(s.clockMinutes).toBe(6 * 60);
    expect(s.sleepRequest).toBeNull();
    expect(s.worldEpoch).toBe(epoch + 1);
  });

  it('running out of energy sends the heroine to sleep; sleep restores it', async () => {
    const store = await playing();
    store.getState().spendEnergy(60);
    expect(store.getState().sleepRequest).toBeNull();
    store.getState().spendEnergy(60);
    expect(store.getState().world.state.player.energy).toBe(0);
    expect(store.getState().sleepRequest).toBe('tired');
    await store.getState().sleep();
    expect(store.getState().world.state.player.energy).toBe(BALANCE.player.maxEnergy);
  });
});

describe('combat', () => {
  async function playing() {
    const store = createGameStore(new SaveStore(memoryStore()), NOW);
    await store.getState().init();
    await store.getState().newGame('Н', { hair: 'red', skin: 'light', shirt: 'green' });
    return store;
  }

  it('defeating an enemy gives XP and loot', async () => {
    const store = await playing();
    const coins = store.getState().world.state.player.coins;
    const loot = store.getState().defeatEnemy('deadline', () => 0);
    expect(store.getState().world.state.player.coins).toBe(coins + loot.coins);
    expect(store.getState().world.state.player.xp).toBe(6);
  });

  it('at zero health: defeat, losses, the day ends; sleep restores health', async () => {
    const store = await playing();
    store.getState().damagePlayer(30);
    expect(store.getState().world.state.player.health).toBe(BALANCE.player.maxHealth - 30);
    store.getState().damagePlayer(500);
    const s = store.getState();
    expect(s.sleepRequest).toBe('defeat');
    expect(s.lastDefeat?.coins).toBe(Math.floor(START * 0.2));
    await store.getState().sleep();
    expect(store.getState().world.state.player.health).toBe(BALANCE.player.maxHealth);
    expect(store.getState().world.state.day).toBe(2);
  });
});

describe('world actions', () => {
  async function playing() {
    const store = createGameStore(new SaveStore(memoryStore()), NOW);
    await store.getState().init();
    await store.getState().newGame('Н', { hair: 'red', skin: 'light', shirt: 'green' });
    return store;
  }

  it('an action spends energy and gives XP only when it succeeds', async () => {
    const { till } = await import('./homestead');
    const store = await playing();
    const e0 = store.getState().world.state.player.energy;
    expect(store.getState().act('till', (w) => till(w, '1,1'))).toBeNull();
    const p = store.getState().world.state.player;
    expect(p.energy).toBe(e0 - BALANCE.actions.till.energy);
    expect(p.xp).toBe(BALANCE.actions.till.xp);
    expect(store.getState().act('till', (w) => till(w, '1,1'))).toBe('alreadyTilled');
    expect(store.getState().world.state.player.energy).toBe(e0 - BALANCE.actions.till.energy);
  });

  it('refuses an action without enough energy', async () => {
    const { till } = await import('./homestead');
    const store = await playing();
    store.getState().spendEnergy(BALANCE.player.maxEnergy - 1);
    expect(store.getState().act('till', (w) => till(w, '2,2'))).toBe('tired');
  });

  it('crops watered today grow overnight when the heroine sleeps', async () => {
    const { till, plant, water } = await import('./homestead');
    const store = await playing();
    const s = store.getState();
    s.act('till', (w) => till(w, '3,3'));
    s.act('plant', (w) => plant(w, '3,3', 'seed-turnip'));
    s.act('water', (w) => water(w, '3,3'));
    await store.getState().sleep();
    expect(store.getState().world.state.plots['3,3']).toMatchObject({ crop: 'turnip', growth: 1, wateredToday: false });
  });
});
