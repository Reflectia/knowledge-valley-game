import * as XLSX from 'xlsx';

import { BALANCE } from './content';
import { EMPTY_CURRICULUM, setScore } from './curriculum';
import { mergePlan, parseCsv, parseFile, parseJsonRows, templateCsv, validateRows, COLUMNS } from './importPlan';
import { deriveProgress, reconcile } from './rewards';
import { newWorld } from './save';

const T = BALANCE.rarityThresholds;

/** The example table from the spec (§7). */
const SPEC_CSV = `semester,discipline_id,discipline_name,theme_pack,has_exam,exam_date,lab_no,lab_title,max_score,deadline,done_date,score
1,mpm_ai,Методологія та процеси моделювання у ШІ,forest,yes,2027-01-15,1,Побудова базової моделі,10,2026-09-25,2026-09-23,9
1,mpm_ai,Методологія та процеси моделювання у ШІ,forest,yes,2027-01-15,2,Валідація моделі,10,2026-10-16,2026-10-18,
1,mpm_ai,Методологія та процеси моделювання у ШІ,forest,yes,2027-01-15,3,,10,2026-11-06,,
1,ai_iit,Штучний інтелект та інноваційні ІТ,tower,no,,1,,8,2026-10-02,2026-10-01,8
1,eng_mgmt,Інженерний менеджмент та технічне управління,market,yes,2027-01-20,1,,10,2026-10-09,,
1,arch_sys,Архітектура технічних систем та ПЗ,forge,no,,1,,10,2026-10-12,,
1,sci_res,Науковий процес та НДР,library,yes,2027-01-25,1,,10,2026-10-20,,
`;

function importText(csv: string) {
  const parsed = parseCsv(csv);
  expect(parsed.errors).toEqual([]);
  return validateRows(parsed.rows);
}

describe('import of the spec example', () => {
  it('creates 5 disciplines and 7 labs with no errors', () => {
    const { plan, errors } = importText(SPEC_CSV);
    expect(errors).toEqual([]);
    expect(plan!.disciplines.map((d) => d.pack)).toEqual(['forest', 'tower', 'market', 'forge', 'library']);
    expect(plan!.labs).toHaveLength(7);
    expect(plan!.labs[0]).toMatchObject({
      key: '1:mpm_ai:1',
      title: 'Побудова базової моделі',
      maxScore: 10,
      deadline: '2026-09-25',
      doneDate: '2026-09-23',
      score: 9,
    });
    expect(plan!.disciplines[1]).not.toHaveProperty('examDate');
  });

  it('rows with done_date and score give retroactive rewards, on time by done date', () => {
    const { plan } = importText(SPEC_CSV);
    const { curriculum, summary } = mergePlan(EMPTY_CURRICULUM, plan!);
    expect(summary).toEqual({ newDisciplines: 5, newLabs: 7, updatedLabs: 0, newlyDone: 3, newlyGraded: 2 });
    const r = reconcile(curriculum, {}, newWorld(), T);
    const done = r.events.filter((e) => e.kind === 'done');
    expect(done.map((e) => [e.labKey, e.kind === 'done' && e.onTime])).toEqual([
      ['1:ai_iit:1', true],
      ['1:mpm_ai:1', true],
      ['1:mpm_ai:2', false], // done 10-18, deadline 10-16
    ]);
    const graded = r.events.filter((e) => e.kind === 'graded');
    expect(graded.map((e) => e.kind === 'graded' && e.rarity)).toEqual(['legendary', 'legendary']);
  });

  it('importing the same file again changes nothing and pays nothing', () => {
    const { plan } = importText(SPEC_CSV);
    const first = mergePlan(EMPTY_CURRICULUM, plan!);
    const paid = reconcile(first.curriculum, {}, newWorld(), T);
    const second = mergePlan(first.curriculum, plan!);
    expect(second.summary).toEqual({ newDisciplines: 0, newLabs: 0, updatedLabs: 0, newlyDone: 0, newlyGraded: 0 });
    const again = reconcile(second.curriculum, paid.ledger, paid.world, T);
    expect(again.events).toEqual([]);
    expect(again.world).toEqual(paid.world);
  });

  it('re-import keeps progress entered in the game when the file cells are empty', () => {
    const { plan } = importText(SPEC_CSV);
    const first = mergePlan(EMPTY_CURRICULUM, plan!).curriculum;
    const edited = setScore(first, '1:mpm_ai:2', 7); // entered in the journal later
    const second = mergePlan(edited, plan!).curriculum;
    expect(second.labs['1:mpm_ai:2'].score).toBe(7);
    expect(deriveProgress(second, T).uniques).toHaveLength(3);
  });

  it('an updated deadline is applied and counted as an update', () => {
    const { plan } = importText(SPEC_CSV);
    const first = mergePlan(EMPTY_CURRICULUM, plan!).curriculum;
    const moved = importText(SPEC_CSV.replace('2026-11-06,,', '2026-11-13,,')).plan!;
    const second = mergePlan(first, moved);
    expect(second.summary.updatedLabs).toBe(1);
    expect(second.curriculum.labs['1:mpm_ai:3'].deadline).toBe('2026-11-13');
  });
});

describe('errors are shown before applying', () => {
  const header = COLUMNS.join(',');
  const row = (over: Record<string, string>) => {
    const base: Record<string, string> = {
      semester: '1',
      discipline_id: 'mpm_ai',
      discipline_name: 'Методологія',
      theme_pack: 'forest',
      has_exam: 'no',
      exam_date: '',
      lab_no: '1',
      lab_title: '',
      max_score: '10',
      deadline: '',
      done_date: '',
      score: '',
      ...over,
    };
    return COLUMNS.map((c) => base[c]).join(',');
  };
  const errorsOf = (...rows: string[]) => importText([header, ...rows].join('\n')).errors;

  it('unknown pack, score above max, bad date (spec examples)', () => {
    expect(errorsOf(row({ theme_pack: 'jungle' }))).toEqual([
      expect.objectContaining({ code: 'unknownPack', row: 2, column: 'theme_pack' }),
    ]);
    expect(errorsOf(row({ done_date: '2026-10-01', score: '12' }))).toEqual([
      expect.objectContaining({ code: 'scoreOutOfRange', row: 2, column: 'score', params: { value: '12', max: 10 } }),
    ]);
    expect(errorsOf(row({ deadline: '06.11.2026' }))).toEqual([
      expect.objectContaining({ code: 'badDate', column: 'deadline' }),
    ]);
  });

  it('required cells, exam date, ids, yes/no, numbers', () => {
    expect(errorsOf(row({ discipline_name: '' }))[0]).toMatchObject({ code: 'required', column: 'discipline_name' });
    expect(errorsOf(row({ has_exam: 'yes' }))[0]).toMatchObject({ code: 'examDateRequired' });
    expect(errorsOf(row({ discipline_id: 'Методологія' }))[0]).toMatchObject({ code: 'badId' });
    expect(errorsOf(row({ has_exam: 'maybe' }))[0]).toMatchObject({ code: 'badYesNo' });
    expect(errorsOf(row({ lab_no: '1.5' }))[0]).toMatchObject({ code: 'notInteger', column: 'lab_no' });
    expect(errorsOf(row({ max_score: '0' }))[0]).toMatchObject({ code: 'maxScoreNotPositive' });
    expect(errorsOf(row({ score: '5' }))[0]).toMatchObject({ code: 'scoreWithoutDone' });
  });

  it('duplicate labs and inconsistent discipline rows', () => {
    expect(errorsOf(row({}), row({}))[0]).toMatchObject({ code: 'duplicateLab', row: 3 });
    expect(errorsOf(row({}), row({ lab_no: '2', theme_pack: 'tower' }))[0]).toMatchObject({
      code: 'disciplineMismatch',
      row: 3,
      params: { id: 'mpm_ai', firstRow: 2 },
    });
  });

  it('missing columns and empty files', () => {
    expect(parseCsv('semester,lab_no\n1,1').errors.map((e) => e.column)).toEqual([
      'discipline_id',
      'discipline_name',
      'theme_pack',
      'has_exam',
      'max_score',
    ]);
    expect(parseCsv('').errors[0].code).toBe('emptyFile');
    expect(parseJsonRows('{nope').errors[0].code).toBe('badFile');
  });

  it('accepts a decimal comma and semicolon-separated CSV (Ukrainian Excel)', () => {
    const csv = [header, row({ done_date: '2026-10-01', score: '7,5' })].join('\n').replaceAll(',', ';').replace('7;5', '7,5');
    const { plan, errors } = importText(csv);
    expect(errors).toEqual([]);
    expect(plan!.labs[0].score).toBe(7.5);
  });
});

describe('formats', () => {
  it('XLSX with real date cells', async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [...COLUMNS],
      [1, 'mpm_ai', 'Методологія', 'forest', 'yes', new Date(2027, 0, 15), 1, 'Модель', 10, new Date(2026, 8, 25), new Date(2026, 8, 23), 9],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plan');
    const buf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: true });
    const parsed = await parseFile('plan.xlsx', buf);
    expect(parsed.errors).toEqual([]);
    const { plan, errors } = validateRows(parsed.rows);
    expect(errors).toEqual([]);
    expect(plan!.labs[0]).toMatchObject({ deadline: '2026-09-25', doneDate: '2026-09-23', score: 9 });
    expect(plan!.disciplines[0].examDate).toBe('2027-01-15');
  });

  it('JSON rows', () => {
    const parsed = parseJsonRows(
      JSON.stringify([
        { semester: 1, discipline_id: 'ai_iit', discipline_name: 'ШІ', theme_pack: 'tower', has_exam: 'no', lab_no: 1, max_score: 8 },
      ]),
    );
    expect(validateRows(parsed.rows).plan!.labs[0]).toMatchObject({ key: '1:ai_iit:1', maxScore: 8 });
  });

  it('the template has every column and parses back without header errors', () => {
    const t = templateCsv();
    expect(t.startsWith('﻿')).toBe(true);
    expect(parseCsv(t + '1,a,A,forest,no,,1,,10,,,').errors).toEqual([]);
  });
});

describe('acceptance: a 24-lab semester plan', () => {
  it('creates 5 locations, mentors and buildings (one discipline per pack)', async () => {
    const { readFileSync } = await import('node:fs');
    const csv = readFileSync('docs/examples/plan-semester1.csv', 'utf-8');
    const { plan, errors } = importText(csv);
    expect(errors).toEqual([]);
    expect(plan!.labs).toHaveLength(24);
    expect(new Set(plan!.disciplines.map((d) => d.pack))).toEqual(new Set(['forest', 'tower', 'market', 'forge', 'library']));
    const progress = deriveProgress(mergePlan(EMPTY_CURRICULUM, plan!).curriculum, T);
    expect(Object.keys(progress.disciplines)).toHaveLength(5);
  });

  it('the example with errors reports them all before applying', async () => {
    const { readFileSync } = await import('node:fs');
    const { plan, errors } = importText(readFileSync('docs/examples/plan-with-errors.csv', 'utf-8'));
    expect(plan).toBeNull();
    expect(errors.map((e) => [e.row, e.code])).toEqual([
      [2, 'unknownPack'],
      [3, 'badDate'],
      [4, 'scoreOutOfRange'],
    ]);
  });
});
