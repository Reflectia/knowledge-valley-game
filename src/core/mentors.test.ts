import { markDone } from './curriculum';
import { dueLetters, mentorLines, MENTORS, visitorsToday, type TalkContext } from './mentors';
import { PACKS } from './content';
import { sampleCurriculum } from './testing';

// sampleCurriculum: mpm_ai (forest) deadlines 09-25, 10-16, 11-06, 11-27, 12-18; ai_iit (tower) 10-02.
const ctx = (over: Partial<TalkContext> = {}): TalkContext => ({
  curriculum: sampleCurriculum(),
  today: '2026-11-04',
  name: 'Ніка',
  atCeiling: false,
  seenDone: 0,
  day: 1,
  firstMeeting: false,
  ...over,
});

describe('mentor content', () => {
  it('every pack has a mentor with all line kinds and short lines', () => {
    for (const pack of Object.keys(PACKS)) {
      const m = MENTORS[pack];
      expect(m).toBeDefined();
      for (const kind of ['greet', 'idle', 'praise', 'ceiling', 'deadline', 'allDone'] as const) {
        expect(m[kind].length).toBeGreaterThan(0);
        // DialogBox: 1–2 lines of body-lg; keep each line short.
        for (const line of m[kind]) expect(line.length).toBeLessThanOrEqual(110);
      }
    }
  });
});

describe('what a mentor says', () => {
  it('greets on the first meeting and uses the name', () => {
    const { lines } = mentorLines('forest', ctx({ firstMeeting: true }));
    expect(lines[0]).toContain('Ніка');
  });

  it('on the deadline day talks about that lab first', () => {
    const { lines } = mentorLines('forest', ctx({ today: '2026-11-06' }));
    expect(lines[0]).toContain('№3');
  });

  it('praises a newly done lab once', () => {
    const c = markDone(sampleCurriculum(), '1:mpm_ai:1', '2026-09-20');
    const first = mentorLines('forest', ctx({ curriculum: c }));
    expect(first.lines[0]).toContain('№1');
    expect(first.done).toBe(1);
    const again = mentorLines('forest', ctx({ curriculum: c, seenDone: first.done }));
    expect(again.lines[0]).not.toContain('№1 готова');
  });

  it('hints at the next lab at the level ceiling', () => {
    const { lines } = mentorLines('tower', ctx({ atCeiling: true }));
    expect(lines[0]).toBe(MENTORS.tower.ceiling[0]);
  });

  it('a mentor without a discipline in the plan still greets', () => {
    expect(mentorLines('market', ctx()).lines).toHaveLength(1);
  });
});

describe('letters and visits (spec §6)', () => {
  it('a welcome letter per discipline, once', () => {
    const first = dueLetters(sampleCurriculum(), '2026-09-01', []);
    expect(first.filter((l) => l.kind === 'welcome').map((l) => l.pack).sort()).toEqual(['forest', 'tower']);
    expect(dueLetters(sampleCurriculum(), '2026-09-01', first)).toEqual([]);
  });

  it('a reminder 3 days before the deadline of an unfinished lab, once', () => {
    const welcome = dueLetters(sampleCurriculum(), '2026-11-01', []).filter((l) => l.kind === 'welcome');
    const reminders = dueLetters(sampleCurriculum(), '2026-11-03', welcome);
    expect(reminders.map((l) => l.id)).toEqual(['reminder:1:mpm_ai:3']);
    expect(reminders[0].body).toContain('№3');
    expect(reminders[0].body).toContain('06.11');
    expect(reminders[0].body).toContain('3 дн.');
    expect(dueLetters(sampleCurriculum(), '2026-11-04', [...welcome, ...reminders])).toEqual([]);
  });

  it('no reminder for done labs, past deadlines or labs without a deadline', () => {
    const c = markDone(sampleCurriculum(), '1:mpm_ai:3', '2026-11-02');
    const welcome = dueLetters(c, '2026-11-01', []);
    expect(dueLetters(c, '2026-11-04', welcome)).toEqual([]);
    expect(dueLetters(sampleCurriculum(), '2026-11-07', welcome)).toEqual([]);
  });

  it('a reminder still comes when the game is first opened 2 days before', () => {
    const letters = dueLetters(sampleCurriculum(), '2026-11-04', []);
    expect(letters.find((l) => l.id === 'reminder:1:mpm_ai:3')?.body).toContain('2 дн.');
  });

  it('the mentor visits on the deadline day of an unfinished lab', () => {
    expect(visitorsToday(sampleCurriculum(), '2026-11-06')).toEqual(['forest']);
    expect(visitorsToday(markDone(sampleCurriculum(), '1:mpm_ai:3', '2026-11-05'), '2026-11-06')).toEqual([]);
    expect(visitorsToday(sampleCurriculum(), '2026-11-05')).toEqual([]);
  });
});
