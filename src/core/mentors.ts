/**
 * Mentors (spec §4, §6): short dialogue lines, reminder letters three days before a
 * deadline and a visit to the homestead on the deadline day. Dates compare with the
 * real date the game is played on. Pure functions; texts live in src/content/mentors.json.
 */
import data from '../content/mentors.json';

import { getPack } from './content';
import type { ExamsWon } from './exam';
import type { DisciplineProgress } from './rewards';
import { daysBetween } from './rules';
import { arcComplete, type ArcBeat } from './story';
import type { Curriculum, Discipline, ISODate, Lab } from './types';

export interface MentorContent {
  greet: string[];
  idle: string[];
  praise: string[];
  ceiling: string[];
  deadline: string[];
  allDone: string[];
  welcome: { title: string; body: string; sign: string };
  reminder: { title: string; body: string; sign: string };
  /** Semester arc (src/core/story.ts): lines per beat. */
  arc: Record<ArcBeat, string[]>;
  /** The letter that ends the arc. */
  arcLetter: { title: string; body: string; sign: string };
}

export const MENTORS: Record<string, MentorContent> = Object.fromEntries(
  Object.entries(data).filter(([k]) => !k.startsWith('_')),
) as Record<string, MentorContent>;

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ''));
}

const dayMonth = (iso: ISODate) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

/** The discipline a pack serves in the plan (latest semester first). */
export function disciplineOfPack(c: Curriculum, pack: string): Discipline | undefined {
  return Object.values(c.disciplines)
    .filter((d) => d.pack === pack)
    .sort((a, b) => b.semester - a.semester)[0];
}

function labsOf(c: Curriculum, d: Discipline): Lab[] {
  return Object.values(c.labs)
    .filter((l) => l.disciplineKey === d.key)
    .sort((a, b) => a.labNo - b.labNo);
}

export interface TalkContext {
  curriculum: Curriculum;
  today: ISODate;
  name: string;
  atCeiling: boolean;
  /** Done labs of this discipline the mentor has already praised. */
  seenDone: number;
  /** Rotates idle lines (e.g. the game day). */
  day: number;
  firstMeeting: boolean;
  /** The arc beat to tell in this talk (story.nextArcBeat), if any. */
  beat?: ArcBeat | null;
}

/**
 * What a mentor says now, most important first: today's deadline, praise for new
 * labs, the level ceiling, everything done, a greeting the first time, else a
 * thought of the day. Returns 1–2 lines and the done count to remember.
 */
export function mentorLines(pack: string, ctx: TalkContext): { lines: string[]; done: number; told?: ArcBeat } {
  const m = MENTORS[pack];
  const d = disciplineOfPack(ctx.curriculum, pack);
  const location = getPack(pack).location.name.uk;
  const base = { name: ctx.name, location, discipline: d?.name ?? '' };
  if (!m) return { lines: [], done: 0 };
  if (!d) return { lines: [fill(m.greet[0], base)], done: 0 };

  const labs = labsOf(ctx.curriculum, d);
  const done = labs.filter((l) => l.doneDate);
  const dueToday = labs.find((l) => !l.doneDate && l.deadline === ctx.today);
  const lines: string[] = [];
  if (ctx.firstMeeting) lines.push(fill(m.greet[0], base));
  const beat = ctx.beat ? m.arc?.[ctx.beat] : undefined;
  let told: ArcBeat | undefined;
  if (dueToday) {
    lines.push(...m.deadline.map((t) => fill(t, { ...base, lab: dueToday.labNo })));
  } else if (beat) {
    // A step of the semester arc: it already says the place has changed, so it stands for the praise too.
    lines.push(...beat.map((t) => fill(t, base)));
    told = ctx.beat!;
  } else if (done.length > ctx.seenDone) {
    const last = done.sort((a, b) => (b.doneDate! > a.doneDate! ? 1 : -1))[0];
    lines.push(fill(m.praise[0], { ...base, lab: last.labNo }));
  } else if (ctx.atCeiling) {
    lines.push(fill(m.ceiling[0], base));
  } else if (labs.length > 0 && done.length === labs.length) {
    lines.push(fill(m.allDone[0], base));
  } else if (!ctx.firstMeeting) {
    lines.push(fill(m.idle[ctx.day % m.idle.length], base));
  } else {
    lines.push(fill(m.greet[1] ?? m.idle[0], base));
  }
  return { lines: lines.slice(0, 3), done: done.length, told };
}

// ------------------------------------------------------------------ mail

export interface Letter {
  /** `welcome:<disciplineKey>`, `reminder:<labKey>` or `arc:<disciplineKey>`: one letter each. */
  id: string;
  kind: 'welcome' | 'reminder' | 'arc';
  pack: string;
  sentOn: ISODate;
  title: string;
  body: string;
  sign: string;
  read: boolean;
}

/** Days before a deadline when the reminder letter arrives (spec §6). */
export const REMINDER_DAYS = 3;

/** What the letters need to know about the arcs: progress per discipline and the exams won. */
export interface ArcState {
  progress: Record<string, DisciplineProgress>;
  exams: ExamsWon;
}

/**
 * New letters for today: a welcome from each mentor whose discipline is in the plan,
 * a reminder for every unfinished lab whose deadline is 1–3 days away, and the letter
 * that ends a mentor's semester arc (spec §4: the exam victory ends the arc).
 */
export function dueLetters(c: Curriculum, today: ISODate, existing: Letter[], arcs?: ArcState): Letter[] {
  const have = new Set(existing.map((l) => l.id));
  const out: Letter[] = [];
  for (const d of Object.values(c.disciplines)) {
    const m = MENTORS[d.pack];
    if (!m) continue;
    const id = `welcome:${d.key}`;
    if (have.has(id)) continue;
    const vars = { discipline: d.name };
    out.push({ id, kind: 'welcome', pack: d.pack, sentOn: today, title: fill(m.welcome.title, vars), body: fill(m.welcome.body, vars), sign: m.welcome.sign, read: false });
  }
  for (const lab of Object.values(c.labs)) {
    if (lab.doneDate || !lab.deadline) continue;
    const left = daysBetween(today, lab.deadline);
    if (left < 1 || left > REMINDER_DAYS) continue;
    const id = `reminder:${lab.key}`;
    if (have.has(id)) continue;
    const d = c.disciplines[lab.disciplineKey];
    const m = MENTORS[d.pack];
    if (!m) continue;
    const vars = { lab: lab.labNo, discipline: d.name, days: left, date: dayMonth(lab.deadline) };
    out.push({ id, kind: 'reminder', pack: d.pack, sentOn: today, title: fill(m.reminder.title, vars), body: fill(m.reminder.body, vars), sign: m.reminder.sign, read: false });
  }
  if (arcs) {
    for (const d of Object.values(c.disciplines)) {
      const m = MENTORS[d.pack];
      const id = `arc:${d.key}`;
      if (!m?.arcLetter || have.has(id) || !arcComplete(d, arcs.progress[d.key], today, arcs.exams)) continue;
      out.push({ id, kind: 'arc', pack: d.pack, sentOn: today, title: m.arcLetter.title, body: m.arcLetter.body, sign: m.arcLetter.sign, read: false });
    }
  }
  return out;
}

/** Mentors who come to the homestead today: a lab of theirs is due today and not done. */
export function visitorsToday(c: Curriculum, today: ISODate): string[] {
  const packs = new Set<string>();
  for (const lab of Object.values(c.labs)) {
    if (!lab.doneDate && lab.deadline === today) packs.add(c.disciplines[lab.disciplineKey].pack);
  }
  return [...packs].sort();
}
