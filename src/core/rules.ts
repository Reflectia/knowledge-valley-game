/** Pure game rules (spec §5–6). No state, no I/O. */
import { BALANCE } from './content';
import type { ISODate, Lab, PlayerState, Rarity, RarityThresholds } from './types';

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in `YYYY-MM-DD`. */
export function isIsoDate(s: string): boolean {
  if (!ISO_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Today in local time as `YYYY-MM-DD` (reminders compare with the real date, spec §6). */
export function todayIso(now: Date = new Date()): ISODate {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  const t = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/**
 * On time = done date ≤ deadline; a lab without a deadline counts as on time.
 * Retroactive entries use the done date the player typed, so they get full rewards.
 */
export function isOnTime(lab: Pick<Lab, 'deadline' | 'doneDate'>): boolean {
  if (!lab.doneDate) return false;
  if (!lab.deadline) return true;
  return lab.doneDate <= lab.deadline;
}

/** Rarity by score / max (thresholds inclusive). */
export function rarityFor(score: number, maxScore: number, t: RarityThresholds): Rarity {
  const ratio = score / maxScore;
  // Small epsilon so 7.5 / 10 is epic, not rare, despite floating point.
  const eps = 1e-9;
  if (ratio + eps >= t.legendary) return 'legendary';
  if (ratio + eps >= t.epic) return 'epic';
  if (ratio + eps >= t.rare) return 'rare';
  return 'common';
}

/** Level ceiling = base + N × done labs (spec §5). */
export function levelCeiling(doneLabs: number, c = BALANCE.ceiling): number {
  return c.base + c.perLab * doneLabs;
}

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number, perLevel = BALANCE.xp.perLevel): number {
  return perLevel * level;
}

/**
 * Add game XP (garden, fights, exploring). At the ceiling no XP accrues; once a
 * lab raises the ceiling, XP grows again (spec §5, acceptance criterion).
 */
export function gainXp(player: PlayerState, amount: number, ceiling: number): PlayerState {
  let { level, xp } = player;
  if (level >= ceiling) return { ...player, xp: 0 };
  xp += Math.max(0, amount);
  while (level < ceiling && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  if (level >= ceiling) xp = 0;
  return { ...player, level, xp };
}

/** True when the player is at the ceiling (mentor hints at the next lab). */
export function atCeiling(player: PlayerState, ceiling: number): boolean {
  return player.level >= ceiling;
}

/**
 * Revival of a location from done / total labs. `progress` (0..1) moves with every
 * lab, so each lab visibly revives the location; `stage` (1..5) maps to the design
 * tokens revival-1…revival-5 (1 = grey start, 5 = full palette).
 */
export function revival(done: number, total: number, stages = BALANCE.revivalStages) {
  const progress = total > 0 ? Math.min(1, done / total) : 0;
  return { progress, stage: 1 + Math.round(progress * (stages - 1)) };
}

/** Discipline building level 0..5: 0 = empty plot; distributed over the labs. */
export function buildingLevel(done: number, total: number, levels = BALANCE.buildingLevels): number {
  if (total <= 0 || done <= 0) return 0;
  return Math.min(levels, Math.ceil((levels * done) / total));
}

/** Weekly backup reminder (spec §9): a week after the last export, or after the start. */
export function needsExportReminder(
  settings: { lastExportAt?: string; createdAt: string },
  now: Date,
  days = BALANCE.exportReminderDays,
): boolean {
  const since = settings.lastExportAt ?? settings.createdAt;
  return now.getTime() - new Date(since).getTime() >= days * 86_400_000;
}
