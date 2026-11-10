/**
 * Mentor arcs and the act 1 story scenes (spec §2, v0.2).
 *
 * A mentor's semester arc follows the discipline: beats at revival stages 2–5, when the exam
 * boss is ready, and the ending — after the exam victory (or when every lab is done, for a
 * discipline without an exam). Each beat is told once, the next time the heroine talks to the
 * mentor; the ending also comes as a letter.
 *
 * Act 1 (semester 1) has four scenes: the arrival letter, meeting all mentors, the first fully
 * revived location and the end of the act (every semester-1 arc complete).
 * Texts are content (src/content/mentors.json `arc`, src/content/story.json): drafts for the owner.
 */
import data from '../content/story.json';

import { examState, type ExamsWon } from './exam';
import type { DisciplineProgress } from './rewards';
import type { Curriculum, Discipline, DisciplineKey, ISODate } from './types';

export type ArcBeat = 'stage2' | 'stage3' | 'stage4' | 'stage5' | 'examReady' | 'won' | 'complete';

/** The arc is over: the exam is won, or there is no exam and every lab is done. */
export function arcComplete(d: Discipline, p: DisciplineProgress | undefined, today: ISODate, won: ExamsWon): boolean {
  const exam = examState(d, p, today, won);
  return exam === 'won' || (exam === 'none' && !!p?.allDone);
}

/** Beats the arc has reached now, in story order. */
export function arcBeats(d: Discipline, p: DisciplineProgress | undefined, today: ISODate, won: ExamsWon): ArcBeat[] {
  if (!p) return [];
  const beats: ArcBeat[] = [];
  for (const s of [2, 3, 4, 5] as const) if (p.revivalStage >= s) beats.push(`stage${s}`);
  const exam = examState(d, p, today, won);
  if (exam === 'ready' || exam === 'won') beats.push('examReady');
  if (exam === 'won') beats.push('won');
  else if (exam === 'none' && p.allDone) beats.push('complete');
  return beats;
}

/**
 * The beat the mentor tells next. Beats come one per talk in order, but a skipped stretch
 * (labs entered all at once) jumps to the latest stage beat, so the mentor does not recite
 * the whole semester; the exam and ending beats are never skipped.
 */
export function nextArcBeat(
  d: Discipline,
  p: DisciplineProgress | undefined,
  today: ISODate,
  won: ExamsWon,
  seen: string[],
): ArcBeat | null {
  const reached = arcBeats(d, p, today, won).filter((b) => !seen.includes(b));
  if (reached.length === 0) return null;
  const stages = reached.filter((b) => b.startsWith('stage'));
  return stages.length > 0 ? stages[stages.length - 1] : reached[0];
}

/** Beats to mark as told together with `beat` (the earlier stage beats it stands for). */
export function toldWith(beat: ArcBeat): ArcBeat[] {
  if (!beat.startsWith('stage')) return [beat];
  const n = Number(beat.slice(5));
  return ([2, 3, 4, 5] as const).filter((s) => s <= n).map((s) => `stage${s}` as ArcBeat);
}

// ----------------------------------------------------------------- act 1 scenes

export interface StoryScene {
  title: string;
  /** Shown one by one; {{name}} is the heroine. */
  lines: string[];
  /** Picture key: a manifest image (the emblem, a portrait). */
  image: string;
  sign?: string;
}

export const SCENES = data.scenes as Record<string, StoryScene>;
export const ACT1_ORDER = ['arrival', 'mentorsMet', 'firstBloom', 'act1End'] as const;
export type SceneId = (typeof ACT1_ORDER)[number];

export interface StoryContext {
  curriculum: Curriculum;
  progress: Record<DisciplineKey, DisciplineProgress>;
  today: ISODate;
  exams: ExamsWon;
  /** Packs whose mentor the heroine has talked to (labs.mentorSeen keys). */
  met: string[];
  seen: string[];
}

/** The act 1 scene to show now, if any: the first one not seen whose moment has come. */
export function nextScene(ctx: StoryContext): SceneId | null {
  const act1 = Object.values(ctx.curriculum.disciplines).filter((d) => d.semester === 1);
  const packs = [...new Set(act1.map((d) => d.pack))];
  const due: Record<SceneId, boolean> = {
    arrival: true,
    mentorsMet: packs.length > 0 && packs.every((p) => ctx.met.includes(p)),
    firstBloom: act1.some((d) => ctx.progress[d.key]?.allDone),
    act1End: act1.length > 0 && act1.every((d) => arcComplete(d, ctx.progress[d.key], ctx.today, ctx.exams)),
  };
  return ACT1_ORDER.find((id) => !ctx.seen.includes(id) && due[id]) ?? null;
}
