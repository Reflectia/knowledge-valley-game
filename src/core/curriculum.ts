/** Curriculum keys and lab edits (journal actions). All functions return new objects. */
import { isIsoDate } from './rules';
import type { Curriculum, DisciplineKey, ISODate, LabKey } from './types';

export const disciplineKey = (semester: number, disciplineId: string): DisciplineKey => `${semester}:${disciplineId}`;
export const labKey = (semester: number, disciplineId: string, labNo: number): LabKey =>
  `${semester}:${disciplineId}:${labNo}`;

export const EMPTY_CURRICULUM: Curriculum = { disciplines: {}, labs: {} };

export class LabEditError extends Error {}

function requireLab(c: Curriculum, key: LabKey) {
  const lab = c.labs[key];
  if (!lab) throw new LabEditError(`Unknown lab: ${key}`);
  return lab;
}

function withLab(c: Curriculum, key: LabKey, patch: Partial<Curriculum['labs'][string]>): Curriculum {
  const lab = { ...requireLab(c, key), ...patch };
  for (const k of Object.keys(patch) as (keyof typeof patch)[]) {
    if (patch[k] === undefined) delete lab[k];
  }
  return { ...c, labs: { ...c.labs, [key]: lab } };
}

/** «Виконано»: the done date defaults to today (spec §6). */
export function markDone(c: Curriculum, key: LabKey, doneDate: ISODate): Curriculum {
  if (!isIsoDate(doneDate)) throw new LabEditError(`Bad date: ${doneDate}`);
  return withLab(c, key, { doneDate });
}

/** Undo «Виконано» (fixing a mistake). The score goes too: it needs a done lab. */
export function unmarkDone(c: Curriculum, key: LabKey): Curriculum {
  return withLab(c, key, { doneDate: undefined, score: undefined });
}

/** «Ввести бал» or fix a wrong score; `undefined` clears it. */
export function setScore(c: Curriculum, key: LabKey, score: number | undefined): Curriculum {
  const lab = requireLab(c, key);
  if (score !== undefined) {
    if (!lab.doneDate) throw new LabEditError('A lab must be done before it gets a score');
    if (lab.maxScore === undefined) throw new LabEditError('The maximum score of this lab is not known yet');
    if (!Number.isFinite(score) || score < 0 || score > lab.maxScore) {
      throw new LabEditError(`Score must be between 0 and ${lab.maxScore}`);
    }
  }
  return withLab(c, key, { score });
}
