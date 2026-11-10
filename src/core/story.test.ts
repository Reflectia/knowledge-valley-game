import { createGameStore } from '@/state/store';

import { dueLetters, mentorLines, MENTORS } from './mentors';
import { deriveProgress } from './rewards';
import { memoryStore, migrate, newLabs, newWorld, SaveStore, toSaveFile } from './save';
import { arcBeats, arcComplete, nextArcBeat, nextScene, SCENES, toldWith } from './story';
import { curriculum, discipline, lab } from './testing';
import type { Curriculum } from './types';

const T = newLabs().settings.rarityThresholds;

/** forest with an exam on 2027-01-15 (4 labs), tower without one (2 labs). */
function plan(forestDone: number, towerDone = 0): Curriculum {
  return curriculum(
    [discipline(1, 'mpm_ai', 'forest', { hasExam: true, examDate: '2027-01-15' }), discipline(1, 'ai_iit', 'tower')],
    [
      ...[1, 2, 3, 4].map((n) => lab(1, 'mpm_ai', n, { doneDate: n <= forestDone ? '2026-10-01' : undefined })),
      ...[1, 2].map((n) => lab(1, 'ai_iit', n, { doneDate: n <= towerDone ? '2026-10-01' : undefined })),
    ],
  );
}
const F = '1:mpm_ai';
const W = '1:ai_iit';

describe('mentor arcs', () => {
  it('reach beats with the revival stages, the exam and its victory', () => {
    const c = plan(4);
    const p = deriveProgress(c, T).disciplines;
    expect(arcBeats(c.disciplines[F], p[F], '2027-01-10', {})).toEqual(['stage2', 'stage3', 'stage4', 'stage5']);
    expect(arcBeats(c.disciplines[F], p[F], '2027-01-15', {})).toContain('examReady');
    const won = { [F]: { date: '2027-01-15', pack: 'forest' } };
    expect(arcBeats(c.disciplines[F], p[F], '2027-01-16', won).slice(-2)).toEqual(['examReady', 'won']);
    expect(arcComplete(c.disciplines[F], p[F], '2027-01-16', won)).toBe(true);
  });

  it('end without an exam when every lab is done', () => {
    const c = plan(0, 2);
    const p = deriveProgress(c, T).disciplines;
    expect(arcBeats(c.disciplines[W], p[W], '2026-11-01', {}).at(-1)).toBe('complete');
    expect(arcComplete(c.disciplines[W], p[W], '2026-11-01', {})).toBe(true);
  });

  it('tell the latest stage when several came at once, never skipping the exam', () => {
    const c = plan(4);
    const p = deriveProgress(c, T).disciplines;
    expect(nextArcBeat(c.disciplines[F], p[F], '2026-12-01', {}, [])).toBe('stage5');
    expect(toldWith('stage5')).toEqual(['stage2', 'stage3', 'stage4', 'stage5']);
    expect(nextArcBeat(c.disciplines[F], p[F], '2027-01-15', {}, toldWith('stage5'))).toBe('examReady');
    expect(nextArcBeat(c.disciplines[F], p[F], '2027-01-15', {}, [...toldWith('stage5'), 'examReady'])).toBeNull();
  });

  it('every mentor has every beat and an arc letter', () => {
    for (const m of Object.values(MENTORS)) {
      for (const b of ['stage2', 'stage3', 'stage4', 'stage5', 'examReady', 'won', 'complete'] as const) {
        expect(m.arc[b].length).toBeGreaterThan(0);
        expect(m.arc[b].length).toBeLessThanOrEqual(2);
      }
      expect(m.arcLetter.body).not.toBe('');
    }
  });

  it('a beat is what the mentor says, unless a deadline is today', () => {
    const c = plan(1);
    const ctx = { curriculum: c, today: '2026-11-01', name: 'Ніка', atCeiling: false, seenDone: 0, day: 1, firstMeeting: false };
    expect(mentorLines('forest', { ...ctx, beat: 'stage2' }).lines).toEqual(MENTORS.forest.arc.stage2);
  });

  it('the arc letter comes once the arc is complete', () => {
    const c = plan(0, 2);
    const progress = deriveProgress(c, T).disciplines;
    const letters = dueLetters(c, '2026-11-01', [], { progress, exams: {} });
    expect(letters.filter((l) => l.kind === 'arc').map((l) => l.id)).toEqual([`arc:${W}`]);
    expect(dueLetters(c, '2026-11-01', letters, { progress, exams: {} })).toEqual([]);
  });
});

describe('act 1 scenes', () => {
  const ctx = (c: Curriculum, extra: Partial<Parameters<typeof nextScene>[0]> = {}) => ({
    curriculum: c,
    progress: deriveProgress(c, T).disciplines,
    today: '2026-11-01',
    exams: {},
    met: [],
    seen: [],
    ...extra,
  });

  it('come in order when their moment has come', () => {
    const c = plan(0, 2);
    expect(nextScene(ctx(c))).toBe('arrival');
    expect(nextScene(ctx(c, { seen: ['arrival'] }))).toBe('firstBloom');
    expect(nextScene(ctx(c, { seen: ['arrival'], met: ['forest', 'tower'] }))).toBe('mentorsMet');
    expect(nextScene(ctx(c, { seen: ['arrival', 'mentorsMet', 'firstBloom'] }))).toBeNull();
    const all = plan(4, 2);
    const won = { [F]: { date: '2027-01-15', pack: 'forest' } };
    expect(nextScene(ctx(all, { seen: ['arrival', 'mentorsMet', 'firstBloom'], exams: won, today: '2027-01-16' }))).toBe('act1End');
  });

  it('every scene has text', () => {
    for (const id of ['arrival', 'mentorsMet', 'firstBloom', 'act1End']) expect(SCENES[id].lines.length).toBeGreaterThan(0);
  });
});

describe('arcs in the game store', () => {
  it('tells each beat once and remembers it after a reload', async () => {
    const saves = new SaveStore(memoryStore());
    const labs = { ...newLabs(), curriculum: plan(2) };
    await saves.replace(toSaveFile(labs, { state: newWorld('Ніка'), ledger: {} }));
    const store = createGameStore(saves, () => new Date('2026-11-01T12:00:00'));
    await store.getState().init();
    store.getState().talkTo('forest');
    expect(store.getState().dialog?.lines.join(' ')).toContain(MENTORS.forest.arc.stage3[0]);
    store.getState().talkTo('forest');
    expect(store.getState().dialog?.lines.join(' ')).not.toContain(MENTORS.forest.arc.stage3[0]);
    await store.getState().seeStory('arrival');
    const again = createGameStore(saves, () => new Date('2026-11-01T13:00:00'));
    await again.getState().init();
    expect(again.getState().labs.arcSeen[F]).toEqual(['stage2', 'stage3']);
    expect(again.getState().labs.story).toEqual(['arrival']);
  });

  it('old saves get empty arc and story records', () => {
    const labs: Partial<ReturnType<typeof newLabs>> = { ...newLabs() };
    delete labs.arcSeen;
    delete labs.story;
    const file = migrate(toSaveFile(labs as ReturnType<typeof newLabs>, { state: newWorld(), ledger: {} }));
    expect(file.labs.arcSeen).toEqual({});
    expect(file.labs.story).toEqual([]);
  });
});

describe('arc beats and deadlines', () => {
  it('a deadline day does not use up the beat', async () => {
    const c = plan(2);
    c.labs['1:mpm_ai:3'] = { ...c.labs['1:mpm_ai:3'], deadline: '2026-11-01' };
    const saves = new SaveStore(memoryStore());
    await saves.replace(toSaveFile({ ...newLabs(), curriculum: c }, { state: newWorld('Ніка'), ledger: {} }));
    const store = createGameStore(saves, () => new Date('2026-11-01T12:00:00'));
    await store.getState().init();
    store.getState().talkTo('forest');
    expect(store.getState().labs.arcSeen[F] ?? []).toEqual([]);
  });
});
