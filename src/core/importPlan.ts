/**
 * Curriculum import (spec §7): one row per lab, discipline fields repeated on every row.
 *
 * parse (CSV / XLSX / JSON) → rows of strings → validate → preview → merge.
 * Merging upserts by `semester + discipline_id + lab_no`. An import never erases
 * progress the player already entered: empty done_date / score cells keep what the
 * game has. Rewards are paid by `reconcile`, so a repeated import pays nothing twice.
 */
import Papa from 'papaparse';

import { PACKS } from './content';
import { disciplineKey, labKey } from './curriculum';
import { isIsoDate, todayIso } from './rules';
import type { Curriculum, Discipline, Lab } from './types';

export const COLUMNS = [
  'semester',
  'discipline_id',
  'discipline_name',
  'theme_pack',
  'has_exam',
  'exam_date',
  'lab_no',
  'lab_title',
  'max_score',
  'deadline',
  'done_date',
  'score',
] as const;
export type Column = (typeof COLUMNS)[number];
const REQUIRED: Column[] = ['semester', 'discipline_id', 'discipline_name', 'theme_pack', 'has_exam', 'lab_no'];

/** A data row: spreadsheet row number (header = row 1) and trimmed cell strings. */
export interface RawRow {
  row: number;
  cells: Partial<Record<Column, string>>;
}

export type ImportErrorCode =
  | 'emptyFile'
  | 'badFile'
  | 'missingColumn'
  | 'foundColumns'
  | 'required'
  | 'notInteger'
  | 'notNumber'
  | 'badDate'
  | 'badYesNo'
  | 'badId'
  | 'unknownPack'
  | 'scoreWithoutMax'
  | 'maxScoreNotPositive'
  | 'scoreOutOfRange'
  | 'scoreWithoutDone'
  | 'duplicateLab'
  | 'disciplineMismatch';

export interface ImportError {
  code: ImportErrorCode;
  /** Spreadsheet row (1 = header); 0 for file-level errors. */
  row: number;
  column?: Column;
  params?: Record<string, string | number>;
}

// ------------------------------------------------------------------ parsing

/**
 * Header cell → column name. Tolerates what spreadsheets add: BOM, zero-width and
 * non-breaking spaces, surrounding quotes, upper case, spaces instead of underscores.
 */
export function normalizeHeader(h: string): string {
  return h
    .replace(/[\uFEFF\u200B-\u200D\u2060]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/^["'«“]+|["'»”]+$/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function toRows(objects: Record<string, unknown>[]): RawRow[] {
  return objects
    .map((obj, i) => {
      const cells: Partial<Record<Column, string>> = {};
      for (const [k, v] of Object.entries(obj)) {
        const col = normalizeHeader(k) as Column;
        if (!(COLUMNS as readonly string[]).includes(col)) continue;
        cells[col] = cellToString(v);
      }
      return { row: i + 2, cells };
    })
    .filter((r) => Object.values(r.cells).some((v) => v !== ''));
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return todayIso(v); // XLSX date cells (local date)
  return String(v).trim();
}

function headerErrors(headers: string[]): ImportError[] {
  const have = new Set(headers.map(normalizeHeader));
  const missing = REQUIRED.filter((c) => !have.has(c)).map((column) => ({ code: 'missingColumn' as const, row: 1, column }));
  if (missing.length === 0) return [];
  // Show what the file really has, so a wrong file or format is easy to spot.
  const found = headers.map((h) => h.trim()).filter(Boolean).slice(0, 8);
  const shown = found.map((h) => (h.length > 24 ? h.slice(0, 24) + '…' : h)).join(', ');
  return [...missing, { code: 'foundColumns', row: 1, params: { columns: shown || '—' } }];
}

export interface ParseResult {
  rows: RawRow[];
  errors: ImportError[];
}

/** Delimiter from the header line: the most frequent of , ; tab | outside quotes. */
export function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/, 1)[0].replace(/"[^"]*"/g, '');
  let best = ',';
  let max = 0;
  for (const d of [',', ';', '\t', '|']) {
    const n = line.split(d).length - 1;
    if (n > max) {
      max = n;
      best = d;
    }
  }
  return best;
}

export function parseCsv(text: string): ParseResult {
  const clean = text.replace(/^\uFEFF/, '');
  const res = Papa.parse<Record<string, string>>(clean, {
    header: true,
    delimiter: detectDelimiter(clean),
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
  });
  const headers = res.meta.fields ?? [];
  if (headers.length === 0) return { rows: [], errors: [{ code: 'emptyFile', row: 0 }] };
  return { rows: toRows(res.data), errors: headerErrors(headers) };
}

export async function parseXlsx(data: ArrayBuffer): Promise<ParseResult> {
  const XLSX = await import('xlsx');
  let wb;
  try {
    wb = XLSX.read(data, { type: 'array', cellDates: true });
  } catch {
    return { rows: [], errors: [{ code: 'badFile', row: 0 }] };
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { rows: [], errors: [{ code: 'emptyFile', row: 0 }] };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' });
  if (matrix.length === 0) return { rows: [], errors: [{ code: 'emptyFile', row: 0 }] };
  const headers = (matrix[0] as unknown[]).map((h) => String(h));
  const objects = matrix.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r as unknown[])[i]])));
  return { rows: toRows(objects), errors: headerErrors(headers) };
}

/** JSON: an array of row objects, or `{ "rows": [...] }`. */
export function parseJsonRows(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { rows: [], errors: [{ code: 'badFile', row: 0 }] };
  }
  const list = Array.isArray(data) ? data : (data as { rows?: unknown })?.rows;
  if (!Array.isArray(list)) return { rows: [], errors: [{ code: 'badFile', row: 0 }] };
  if (list.length === 0) return { rows: [], errors: [{ code: 'emptyFile', row: 0 }] };
  const headers = [...new Set(list.flatMap((o) => Object.keys(o as object)))];
  return { rows: toRows(list as Record<string, unknown>[]), errors: headerErrors(headers) };
}

/**
 * Bytes → text for CSV/JSON. Excel saves CSV as UTF-8 (with or without BOM),
 * "Unicode text" as UTF-16, and plain "CSV" in the Windows code page
 * (Windows-1251 for Ukrainian), so all three are recognized.
 */
export function decodeText(data: ArrayBuffer): string {
  const b = new Uint8Array(data);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
  // UTF-16 without a BOM: every other byte of ASCII text is zero.
  const sample = b.subarray(0, 200);
  let zeroOdd = 0;
  let zeroEven = 0;
  sample.forEach((v, i) => v === 0 && (i % 2 ? zeroOdd++ : zeroEven++));
  if (zeroOdd > sample.length / 4) return new TextDecoder('utf-16le').decode(b);
  if (zeroEven > sample.length / 4) return new TextDecoder('utf-16be').decode(b);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    return new TextDecoder('windows-1251').decode(b);
  }
}

export async function parseFile(name: string, data: ArrayBuffer): Promise<ParseResult> {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'xlsx' || ext === 'xls') return parseXlsx(data);
  const text = decodeText(data);
  if (ext === 'json') return parseJsonRows(text);
  return parseCsv(text);
}

// ------------------------------------------------------------------ validation

export interface ValidatedPlan {
  disciplines: Discipline[];
  labs: Lab[];
}

const ID_RE = /^[a-z][a-z0-9_]*$/;

function num(s: string): number {
  return Number(s.replace(',', '.'));
}

/** Check every row; returns the plan only when there are no errors. */
export function validateRows(rows: RawRow[]): { plan: ValidatedPlan | null; errors: ImportError[] } {
  const errors: ImportError[] = [];
  const disciplines = new Map<string, { d: Discipline; row: number }>();
  const labs = new Map<string, Lab>();
  if (rows.length === 0) return { plan: null, errors: [{ code: 'emptyFile', row: 0 }] };

  for (const { row, cells } of rows) {
    const err = (code: ImportErrorCode, column?: Column, params?: ImportError['params']) =>
      errors.push({ code, row, column, params });
    const get = (c: Column) => cells[c] ?? '';
    let ok = true;
    for (const c of REQUIRED) {
      if (get(c) === '') {
        err('required', c);
        ok = false;
      }
    }

    const int = (c: Column) => {
      const v = get(c);
      if (v === '') return undefined;
      const n = num(v);
      if (!Number.isInteger(n) || n < 1) {
        err('notInteger', c, { value: v });
        ok = false;
        return undefined;
      }
      return n;
    };
    const decimal = (c: Column) => {
      const v = get(c);
      if (v === '') return undefined;
      const n = num(v);
      if (!Number.isFinite(n)) {
        err('notNumber', c, { value: v });
        ok = false;
        return undefined;
      }
      return n;
    };
    const date = (c: Column) => {
      const v = get(c);
      if (v === '') return undefined;
      if (!isIsoDate(v)) {
        err('badDate', c, { value: v });
        ok = false;
        return undefined;
      }
      return v;
    };

    const semester = int('semester');
    const labNo = int('lab_no');
    const id = get('discipline_id');
    if (id && !ID_RE.test(id)) {
      err('badId', 'discipline_id', { value: id });
      ok = false;
    }
    const pack = get('theme_pack').toLowerCase();
    if (pack && !PACKS[pack]) {
      err('unknownPack', 'theme_pack', { value: pack, known: Object.keys(PACKS).sort().join(', ') });
      ok = false;
    }
    const examRaw = get('has_exam').toLowerCase();
    const hasExam = ['yes', 'так', 'true', '1'].includes(examRaw)
      ? true
      : ['no', 'ні', 'false', '0'].includes(examRaw)
        ? false
        : undefined;
    if (examRaw && hasExam === undefined) {
      err('badYesNo', 'has_exam', { value: get('has_exam') });
      ok = false;
    }
    // The exam date may stay empty until it is announced.
    const examDate = date('exam_date');
    // Empty max_score = not announced yet.
    const maxScore = decimal('max_score');
    if (maxScore !== undefined && maxScore <= 0) {
      err('maxScoreNotPositive', 'max_score', { value: get('max_score') });
      ok = false;
    }
    const deadline = date('deadline');
    const doneDate = date('done_date');
    const score = decimal('score');
    if (score !== undefined && maxScore !== undefined && maxScore > 0 && (score < 0 || score > maxScore)) {
      err('scoreOutOfRange', 'score', { value: get('score'), max: maxScore });
      ok = false;
    }
    if (score !== undefined && get('done_date') === '') {
      err('scoreWithoutDone', 'score');
      ok = false;
    }
    if (score !== undefined && maxScore === undefined) {
      err('scoreWithoutMax', 'score');
      ok = false;
    }
    if (!ok || semester === undefined || labNo === undefined || hasExam === undefined) continue;

    const dKey = disciplineKey(semester, id);
    const d: Discipline = {
      key: dKey,
      semester,
      id,
      name: get('discipline_name'),
      pack,
      hasExam,
      ...(hasExam && examDate ? { examDate } : {}),
    };
    const seen = disciplines.get(dKey);
    if (!seen) disciplines.set(dKey, { d, row });
    else if (seen.d.name !== d.name || seen.d.pack !== d.pack || seen.d.hasExam !== d.hasExam || seen.d.examDate !== d.examDate) {
      err('disciplineMismatch', undefined, { id, firstRow: seen.row });
      continue;
    }

    const key = labKey(semester, id, labNo);
    if (labs.has(key)) {
      err('duplicateLab', 'lab_no', { id, labNo });
      continue;
    }
    const title = get('lab_title');
    labs.set(key, {
      key,
      disciplineKey: dKey,
      semester,
      disciplineId: id,
      labNo,
      ...(maxScore !== undefined ? { maxScore } : {}),
      ...(title ? { title } : {}),
      ...(deadline ? { deadline } : {}),
      ...(doneDate ? { doneDate } : {}),
      ...(score !== undefined ? { score } : {}),
    });
  }

  errors.sort((a, b) => a.row - b.row);
  if (errors.length) return { plan: null, errors };
  return { plan: { disciplines: [...disciplines.values()].map((v) => v.d), labs: [...labs.values()] }, errors };
}

// ------------------------------------------------------------------ merge & preview

export interface ImportSummary {
  newDisciplines: number;
  newLabs: number;
  updatedLabs: number;
  /** Labs that become done / graded with this import (retroactive rewards). */
  newlyDone: number;
  newlyGraded: number;
  /**
   * Disciplines of the file's semesters that the file no longer has (e.g. a changed
   * discipline_id) and that have no progress: removed, so the journal has no stale twin.
   */
  removedDisciplines: string[];
  /** Same, but with done labs or scores: kept, so no progress is lost; the preview warns. */
  staleDisciplines: string[];
}

/** Upsert the plan into the current curriculum, keeping progress the file leaves empty. */
export function mergePlan(current: Curriculum, plan: ValidatedPlan): { curriculum: Curriculum; summary: ImportSummary } {
  const disciplines = { ...current.disciplines };
  const labs = { ...current.labs };
  const summary: ImportSummary = {
    newDisciplines: 0,
    newLabs: 0,
    updatedLabs: 0,
    newlyDone: 0,
    newlyGraded: 0,
    removedDisciplines: [],
    staleDisciplines: [],
  };

  // A re-import replaces the plan of the semesters it covers (spec §7 keys: semester + discipline_id).
  const semesters = new Set(plan.disciplines.map((d) => d.semester));
  const inFile = new Set(plan.disciplines.map((d) => d.key));
  for (const d of Object.values(current.disciplines)) {
    if (!semesters.has(d.semester) || inFile.has(d.key)) continue;
    const own = Object.values(labs).filter((l) => l.disciplineKey === d.key);
    if (own.some((l) => l.doneDate || l.score !== undefined)) {
      summary.staleDisciplines.push(d.name);
      continue;
    }
    delete disciplines[d.key];
    for (const l of own) delete labs[l.key];
    summary.removedDisciplines.push(d.name);
  }

  for (const d of plan.disciplines) {
    if (!disciplines[d.key]) summary.newDisciplines += 1;
    disciplines[d.key] = d;
  }
  for (const incoming of plan.labs) {
    const prev = labs[incoming.key];
    const doneDate = incoming.doneDate ?? prev?.doneDate;
    const score = incoming.score ?? (doneDate ? prev?.score : undefined);
    const next: Lab = { ...incoming };
    if (doneDate) next.doneDate = doneDate;
    // A kept score must still fit the (possibly changed) maximum.
    if (score !== undefined && next.maxScore !== undefined && score <= next.maxScore) next.score = score;
    else delete next.score;

    if (!prev) summary.newLabs += 1;
    else if (JSON.stringify(prev) !== JSON.stringify(next)) summary.updatedLabs += 1;
    if (next.doneDate && !prev?.doneDate) summary.newlyDone += 1;
    if (next.score !== undefined && prev?.score === undefined) summary.newlyGraded += 1;
    labs[next.key] = next;
  }
  return { curriculum: { disciplines, labs }, summary };
}

/** «Завантажити шаблон»: CSV with the headers (UTF-8 BOM so Excel reads Cyrillic). */
export function templateCsv(): string {
  return '\uFEFF' + COLUMNS.join(',') + '\r\n';
}
