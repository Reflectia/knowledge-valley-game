/**
 * Exam bosses (spec §4). A boss exists only for disciplines marked «екзамен» in the plan.
 * It can be fought when every lab of the discipline is done and the real exam date has come.
 * The fight is purely in the game: no real exam grade is entered. On-time labs give
 * knowledge-shield charges that block boss hits. A victory gives a trophy for the house and
 * ends the mentor's semester arc; a defeat is an ordinary defeat (home, the day ends), so the
 * boss is there again the next day.
 */
import data from '../content/bosses.json';

import { addItem } from './homestead';
import type { DisciplineProgress } from './rewards';
import type { Curriculum, Discipline, DisciplineKey, ISODate, WorldState } from './types';

export interface BossDef {
  name: string;
  text: string;
  /** Biome enemy drawn ×2 until the boss has its own 32×32 art. */
  placeholder: string;
  hp: number;
  damage: number;
  speed: number;
  aggro: number;
  xp: number;
  coins: number;
  /** Trophy item id (furniture for the house). */
  trophy: string;
}

export const BOSSES = data.bosses as Record<string, BossDef>;
/** How far the boss follows the heroine from its place before going back (px). */
export const BOSS_LEASH = data.leash;

export function bossFor(pack: string): BossDef | undefined {
  return BOSSES[pack];
}

/**
 * - `none`: no exam for this discipline (or the pack has no boss);
 * - `labs`: some labs are not done yet;
 * - `date`: all labs done, the exam date is unknown or still ahead;
 * - `ready`: the boss waits in the location;
 * - `won`: the exam boss is beaten.
 */
export type ExamState = 'none' | 'labs' | 'date' | 'ready' | 'won';

/**
 * Exams won: discipline key → the real date of the victory and the pack (so the trophy is
 * known even if a later plan import drops the discipline). Saved with the labs.
 */
export type ExamsWon = Record<DisciplineKey, { date: ISODate; pack: string }>;

export function examState(d: Discipline, p: DisciplineProgress | undefined, today: ISODate, won: ExamsWon): ExamState {
  if (!d.hasExam || !bossFor(d.pack)) return 'none';
  if (won[d.key]) return 'won';
  if (!p?.allDone) return 'labs';
  if (!d.examDate || today < d.examDate) return 'date';
  return 'ready';
}

/** The discipline whose boss waits in this pack's location today, if any. */
export function readyBossIn(
  pack: string,
  curriculum: Curriculum,
  progress: Record<DisciplineKey, DisciplineProgress>,
  today: ISODate,
  won: ExamsWon,
): Discipline | null {
  const ready = Object.values(curriculum.disciplines)
    .filter((d) => d.pack === pack && examState(d, progress[d.key], today, won) === 'ready')
    .sort((a, b) => a.semester - b.semester || a.key.localeCompare(b.key));
  return ready[0] ?? null;
}

/** Hits the knowledge shield blocks in a boss fight: one per on-time lab. */
export function shieldHits(p: DisciplineProgress | undefined): number {
  return (p?.shieldCharges ?? 0) * data.shield.hitsPerCharge;
}

/**
 * Put the trophy of every won exam into the world exactly once. `world.trophies` remembers
 * which exams already paid, so a reload (the world is saved at night, the victory at once)
 * pays a missing trophy and never a second one.
 */
export function payTrophies(world: WorldState, won: ExamsWon): WorldState {
  const paid = new Set(world.trophies ?? []);
  let next = world;
  for (const [key, w] of Object.entries(won).sort(([a], [b]) => a.localeCompare(b))) {
    if (paid.has(key)) continue;
    const boss = bossFor(w.pack);
    paid.add(key);
    if (boss) next = addItem(next, boss.trophy);
  }
  return paid.size === (world.trophies ?? []).length ? world : { ...next, trophies: [...paid].sort() };
}
