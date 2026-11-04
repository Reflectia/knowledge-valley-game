/** Test fixtures: a small curriculum shaped like the spec's import example (§7). */
import { disciplineKey, labKey } from './curriculum';
import type { Curriculum, Discipline, Lab } from './types';

export function discipline(semester: number, id: string, pack: string, extra: Partial<Discipline> = {}): Discipline {
  return { key: disciplineKey(semester, id), semester, id, name: id, pack, hasExam: false, ...extra };
}

export function lab(semester: number, disciplineId: string, labNo: number, extra: Partial<Lab> = {}): Lab {
  return {
    key: labKey(semester, disciplineId, labNo),
    disciplineKey: disciplineKey(semester, disciplineId),
    semester,
    disciplineId,
    labNo,
    maxScore: 10,
    ...extra,
  };
}

export function curriculum(disciplines: Discipline[], labs: Lab[]): Curriculum {
  return {
    disciplines: Object.fromEntries(disciplines.map((d) => [d.key, d])),
    labs: Object.fromEntries(labs.map((l) => [l.key, l])),
  };
}

/** mpm_ai (forest, 5 labs) and ai_iit (tower, 4 labs, max 8), nothing done yet. */
export function sampleCurriculum(): Curriculum {
  return curriculum(
    [
      discipline(1, 'mpm_ai', 'forest', { hasExam: true, examDate: '2027-01-15' }),
      discipline(1, 'ai_iit', 'tower'),
    ],
    [
      lab(1, 'mpm_ai', 1, { deadline: '2026-09-25' }),
      lab(1, 'mpm_ai', 2, { deadline: '2026-10-16' }),
      lab(1, 'mpm_ai', 3, { deadline: '2026-11-06' }),
      lab(1, 'mpm_ai', 4, { deadline: '2026-11-27' }),
      lab(1, 'mpm_ai', 5, { deadline: '2026-12-18' }),
      lab(1, 'ai_iit', 1, { maxScore: 8, deadline: '2026-10-02' }),
      lab(1, 'ai_iit', 2, { maxScore: 8 }),
      lab(1, 'ai_iit', 3, { maxScore: 8 }),
      lab(1, 'ai_iit', 4, { maxScore: 8 }),
    ],
  );
}
