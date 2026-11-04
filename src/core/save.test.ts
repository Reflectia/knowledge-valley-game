import { createGameStore } from '@/state/store';

import { BALANCE } from './content';
import { memoryStore, migrate, newLabs, newWorld, parseSaveFile, SaveError, SaveStore, SAVE_VERSION, toSaveFile } from './save';
import { sampleCurriculum } from './testing';

const R = BALANCE.rewards;
const NOW = () => new Date('2026-11-04T12:00:00Z');

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
    const v1 = toSaveFile(newLabs(), { state: newWorld(), ledger: {} });
    const out = migrate(v1, migrations, 3) as unknown as { version: number; note: string };
    expect(out.version).toBe(3);
    expect(out.note).toBe('v2+v3');
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
    await store.getState().newGame('Надійка');
    const again = await started(kv);
    expect(again.store.getState().hasSave).toBe(true);
    expect(again.store.getState().world.state.player.name).toBe('Надійка');
  });

  it('closing the tab mid-day keeps lab data and pays its rewards exactly once', async () => {
    const { store, kv } = await started();
    await store.getState().newGame('Н');
    await store.getState().setCurriculum(sampleCurriculum());
    await store.getState().markLabDone('1:mpm_ai:1', '2026-09-23');
    expect(store.getState().world.state.player.coins).toBe(R.done.coins + R.onTime.coins);

    // No sleep: the world was not saved, the labs were.
    const reopened = (await started(kv)).store;
    const s = reopened.getState();
    expect(s.labs.curriculum.labs['1:mpm_ai:1'].doneDate).toBe('2026-09-23');
    expect(s.world.state.player.coins).toBe(R.done.coins + R.onTime.coins);
    expect(s.progress.ceiling).toBe(BALANCE.ceiling.base + BALANCE.ceiling.perLab);

    // After sleeping and reopening, nothing is paid again.
    await reopened.getState().sleep();
    const third = (await started(kv)).store.getState();
    expect(third.world.state.player.coins).toBe(R.done.coins + R.onTime.coins);
    expect(third.world.state.day).toBe(2);
    expect(third.pendingRewards).toEqual([]);
  });

  it('export then import restores the game completely', async () => {
    const { store } = await started();
    await store.getState().newGame('Н');
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
});
