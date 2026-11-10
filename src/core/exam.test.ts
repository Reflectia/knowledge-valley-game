import { createGameStore } from '@/state/store';

import { BOSSES, examState, payTrophies, readyBossIn, shieldHits } from './exam';
import { deriveProgress } from './rewards';
import { memoryStore, migrate, newLabs, newWorld, SaveStore, toSaveFile } from './save';
import { curriculum, discipline, lab } from './testing';
import type { Curriculum } from './types';

const T = newLabs().settings.rarityThresholds;

/** forest exam on 2027-01-15, two labs; tower without an exam. */
function plan(done: { forest?: [string?, string?] } = {}): Curriculum {
  const [d1, d2] = done.forest ?? [];
  return curriculum(
    [discipline(1, 'mpm_ai', 'forest', { hasExam: true, examDate: '2027-01-15' }), discipline(1, 'ai_iit', 'tower')],
    [
      lab(1, 'mpm_ai', 1, { deadline: '2026-10-01', doneDate: d1 }),
      lab(1, 'mpm_ai', 2, { deadline: '2026-11-01', doneDate: d2 }),
      lab(1, 'ai_iit', 1, { doneDate: '2026-10-01' }),
    ],
  );
}

describe('exam boss availability (spec §4)', () => {
  const state = (c: Curriculum, today: string, won = {}) => {
    const p = deriveProgress(c, T).disciplines;
    return examState(c.disciplines['1:mpm_ai'], p['1:mpm_ai'], today, won);
  };

  it('needs every lab done and the exam date reached', () => {
    expect(state(plan({ forest: ['2026-09-30'] }), '2027-02-01')).toBe('labs');
    expect(state(plan({ forest: ['2026-09-30', '2026-10-30'] }), '2027-01-14')).toBe('date');
    expect(state(plan({ forest: ['2026-09-30', '2026-10-30'] }), '2027-01-15')).toBe('ready');
    expect(state(plan({ forest: ['2026-09-30', '2026-10-30'] }), '2027-01-15', { '1:mpm_ai': { date: '2027-01-15', pack: 'forest' } })).toBe('won');
  });

  it('has no boss without the exam mark, and waits while the exam date is unknown', () => {
    const c = plan();
    const p = deriveProgress(c, T).disciplines;
    expect(examState(c.disciplines['1:ai_iit'], p['1:ai_iit'], '2027-02-01', {})).toBe('none');
    const noDate = curriculum([discipline(1, 'x', 'forest', { hasExam: true })], [lab(1, 'x', 1, { doneDate: '2026-10-01' })]);
    expect(examState(noDate.disciplines['1:x'], deriveProgress(noDate, T).disciplines['1:x'], '2030-01-01', {})).toBe('date');
  });

  it('finds the ready boss of a location', () => {
    const c = plan({ forest: ['2026-09-30', '2026-10-30'] });
    const p = deriveProgress(c, T).disciplines;
    expect(readyBossIn('forest', c, p, '2027-01-20', {})?.key).toBe('1:mpm_ai');
    expect(readyBossIn('tower', c, p, '2027-01-20', {})).toBeNull();
  });

  it('gives one shield hit per on-time lab', () => {
    // lab 1 on time, lab 2 late
    const c = plan({ forest: ['2026-09-30', '2026-11-05'] });
    expect(shieldHits(deriveProgress(c, T).disciplines['1:mpm_ai'])).toBe(1);
  });
});

describe('trophies', () => {
  it('are paid once per won exam', () => {
    const won = { '1:mpm_ai': { date: '2027-01-15', pack: 'forest' } };
    const once = payTrophies(newWorld(), won);
    expect(once.inventory[BOSSES.forest.trophy]).toBe(1);
    expect(once.trophies).toEqual(['1:mpm_ai']);
    expect(payTrophies(once, won)).toBe(once);
  });
});

describe('winning an exam in the game store', () => {
  const ready = plan({ forest: ['2026-09-30', '2026-10-30'] });

  async function storeAt(date: string) {
    const kv = memoryStore();
    const saves = new SaveStore(kv);
    const labs = { ...newLabs(), curriculum: ready };
    await saves.replace(toSaveFile(labs, { state: newWorld('Ніка'), ledger: {} }));
    const store = createGameStore(saves, () => new Date(`${date}T12:00:00`));
    await store.getState().init();
    return { store, saves };
  }

  it('saves the victory at once, gives the trophy, coins and XP, and only once', async () => {
    const { store, saves } = await storeAt('2027-01-16');
    const coins = store.getState().world.state.player.coins;
    expect(await store.getState().winExam('1:mpm_ai')).toBe(true);
    const s = store.getState();
    expect(s.labs.exams['1:mpm_ai']).toEqual({ date: '2027-01-16', pack: 'forest' });
    expect(s.world.state.inventory['trophy-forest']).toBe(1);
    expect(s.world.state.player.coins).toBe(coins + BOSSES.forest.coins);
    expect(s.examVictory?.disciplineKey).toBe('1:mpm_ai');
    expect(await store.getState().winExam('1:mpm_ai')).toBe(false);
    expect(store.getState().world.state.inventory['trophy-forest']).toBe(1);

    // The tab closes before the night save: the victory is in the labs, the trophy comes back once.
    const again = createGameStore(saves, () => new Date('2027-01-16T13:00:00'));
    await again.getState().init();
    expect(again.getState().labs.exams['1:mpm_ai']).toBeDefined();
    expect(again.getState().world.state.inventory['trophy-forest']).toBe(1);
  });

  it('refuses a boss before the exam date', async () => {
    const { store } = await storeAt('2027-01-10');
    expect(await store.getState().winExam('1:mpm_ai')).toBe(false);
    expect(store.getState().labs.exams).toEqual({});
  });

  it('old saves get an empty exam record', () => {
    const labs: Partial<ReturnType<typeof newLabs>> = { ...newLabs() };
    delete labs.exams;
    const file = migrate({ ...toSaveFile(labs as ReturnType<typeof newLabs>, { state: newWorld(), ledger: {} }) });
    expect(file.labs.exams).toEqual({});
  });
});

describe('unique lab items in the bag', () => {
  it('are in the bag while not on display, never twice', async () => {
    const { syncUniques } = await import('./exam');
    const earned = [{ itemId: 'forest-unique-1' }, { itemId: 'forest-unique-2' }];
    const w = syncUniques(newWorld(), earned);
    expect(w.inventory['forest-unique-1']).toBe(1);
    expect(syncUniques(w, earned)).toBe(w);
    const shown = { ...w, inventory: { ...w.inventory }, decor: [{ uid: 1, item: 'forest-unique-1', map: 'house', x: 3, y: 3 }] };
    delete shown.inventory['forest-unique-1'];
    expect(syncUniques(shown, earned).inventory['forest-unique-1']).toBeUndefined();
    // a lab no longer graded takes its item out of the bag
    expect(syncUniques(w, [earned[1]]).inventory['forest-unique-1']).toBeUndefined();
  });
});
