import { BALANCE } from './content';
import {
  buildingLevel,
  daysBetween,
  gainXp,
  isIsoDate,
  isOnTime,
  levelCeiling,
  needsExportReminder,
  rarityFor,
  revival,
  todayIso,
  xpToNext,
} from './rules';
import { newWorld } from './save';

const T = BALANCE.rarityThresholds;

describe('dates', () => {
  it('accepts only real YYYY-MM-DD dates', () => {
    expect(isIsoDate('2026-11-06')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('06.11.2026')).toBe(false);
    expect(isIsoDate('2026-1-6')).toBe(false);
  });

  it('formats today in local time and counts days', () => {
    expect(todayIso(new Date(2026, 10, 4, 23, 59))).toBe('2026-11-04');
    expect(daysBetween('2026-11-03', '2026-11-06')).toBe(3);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });
});

describe('on time (spec §6)', () => {
  it('is on time when done on or before the deadline', () => {
    expect(isOnTime({ deadline: '2026-10-16', doneDate: '2026-10-16' })).toBe(true);
    expect(isOnTime({ deadline: '2026-10-16', doneDate: '2026-10-01' })).toBe(true);
  });
  it('is late after the deadline', () => {
    expect(isOnTime({ deadline: '2026-10-16', doneDate: '2026-10-18' })).toBe(false);
  });
  it('counts a lab without a deadline as on time', () => {
    expect(isOnTime({ doneDate: '2026-10-18' })).toBe(true);
  });
  it('is never on time when not done', () => {
    expect(isOnTime({ deadline: '2026-10-16' })).toBe(false);
  });
});

describe('rarity by score (spec §6 table, max 10)', () => {
  it.each([
    [10, 'legendary'],
    [9, 'legendary'],
    [8.9, 'epic'],
    [7.5, 'epic'],
    [7.4, 'rare'],
    [6, 'rare'],
    [5.9, 'common'],
    [0, 'common'],
  ] as const)('%s / 10 → %s', (score, rarity) => {
    expect(rarityFor(score, 10, T)).toBe(rarity);
  });

  it('works with other maximums (max 8)', () => {
    expect(rarityFor(8, 8, T)).toBe('legendary');
    expect(rarityFor(6, 8, T)).toBe('epic'); // 75 %
    expect(rarityFor(4.8, 8, T)).toBe('rare'); // 60 %
  });

  it('uses edited thresholds', () => {
    expect(rarityFor(8, 10, { rare: 0.5, epic: 0.7, legendary: 0.8 })).toBe('legendary');
  });
});

describe('level ceiling and XP (spec §5)', () => {
  it('ceiling = 3 + 2 × done labs', () => {
    expect(levelCeiling(0)).toBe(3);
    expect(levelCeiling(1)).toBe(5);
    expect(levelCeiling(24)).toBe(51);
  });

  it('stops XP at the ceiling and resumes when the ceiling rises', () => {
    let p = newWorld().player; // level 1
    const lots = xpToNext(1) + xpToNext(2) + 1000;
    p = gainXp(p, lots, levelCeiling(0));
    expect(p.level).toBe(3);
    expect(p.xp).toBe(0);
    p = gainXp(p, 500, levelCeiling(0));
    expect(p).toMatchObject({ level: 3, xp: 0 });
    p = gainXp(p, xpToNext(3) + 5, levelCeiling(1));
    expect(p).toMatchObject({ level: 4, xp: 5 });
  });

  it('keeps leftover XP inside a level', () => {
    const p = gainXp(newWorld().player, 7, 10);
    expect(p).toMatchObject({ level: 1, xp: 7 });
  });
});

describe('revival and buildings are spread over the labs', () => {
  it('5 labs: every lab moves revival and adds a building level', () => {
    const stages = [0, 1, 2, 3, 4, 5].map((d) => revival(d, 5));
    expect(stages[0]).toEqual({ progress: 0, stage: 1 });
    expect(stages[5]).toEqual({ progress: 1, stage: 5 });
    const progress = stages.map((s) => s.progress);
    expect(progress).toEqual([...progress].sort());
    expect(new Set(progress).size).toBe(6);
    expect([0, 1, 2, 3, 4, 5].map((d) => buildingLevel(d, 5))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('4 labs: last lab reaches the top stage and building level', () => {
    expect(revival(4, 4).stage).toBe(5);
    expect([0, 1, 2, 3, 4].map((d) => buildingLevel(d, 4))).toEqual([0, 2, 3, 4, 5]);
  });

  it('8 labs: building levels never decrease and end at 5', () => {
    const levels = [...Array(9).keys()].map((d) => buildingLevel(d, 8));
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(levels[8]).toBe(5);
  });
});

describe('weekly export reminder (spec §9)', () => {
  const createdAt = '2026-11-01T10:00:00.000Z';
  it('waits a week after the start', () => {
    expect(needsExportReminder({ createdAt }, new Date('2026-11-05T10:00:00Z'))).toBe(false);
    expect(needsExportReminder({ createdAt }, new Date('2026-11-08T10:00:00Z'))).toBe(true);
  });
  it('counts from the last export', () => {
    const s = { createdAt, lastExportAt: '2026-11-07T10:00:00.000Z' };
    expect(needsExportReminder(s, new Date('2026-11-10T10:00:00Z'))).toBe(false);
    expect(needsExportReminder(s, new Date('2026-11-14T10:00:00Z'))).toBe(true);
  });
});
