import { useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { getPack } from '@/core/content';
import {
  mergePlan,
  parseFile,
  templateCsv,
  validateRows,
  type ImportError,
  type ImportSummary,
  type ValidatedPlan,
} from '@/core/importPlan';
import type { Curriculum } from '@/core/types';

import { LabStatus } from '../components/LabStatus';
import { useGame, useGameApi } from '../GameContext';
import { dayMonth, downloadText } from '../format';

type Step =
  | { kind: 'idle' }
  | { kind: 'reading'; name: string }
  | { kind: 'errors'; name: string; errors: ImportError[] }
  | { kind: 'preview'; name: string; plan: ValidatedPlan; curriculum: Curriculum; summary: ImportSummary }
  | { kind: 'applied'; rewards: number };

/** Plan import (spec §7, screen 10): file → preview and errors → apply. */
export function ImportScreen({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const current = useGame((s) => s.labs.curriculum);
  const thresholds = useGame((s) => s.labs.settings.rarityThresholds);
  const setCurriculum = useGame((s) => s.setCurriculum);
  const api = useGameApi();
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);


  async function read(file: File) {
    setStep({ kind: 'reading', name: file.name });
    const parsed = await parseFile(file.name, await file.arrayBuffer());
    const checked = parsed.errors.length ? { plan: null, errors: parsed.errors } : validateRows(parsed.rows);
    if (!checked.plan) {
      setStep({ kind: 'errors', name: file.name, errors: checked.errors });
      return;
    }
    const { curriculum, summary } = mergePlan(current, checked.plan);
    setStep({ kind: 'preview', name: file.name, plan: checked.plan, curriculum, summary });
  }

  async function apply() {
    if (step.kind !== 'preview') return;
    const before = api.getState().pendingRewards.length;
    await setCurriculum(step.curriculum);
    setStep({ kind: 'applied', rewards: api.getState().pendingRewards.length - before });
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void read(file);
  }

  const errorText = (e: ImportError) =>
    t(`import.errors.${e.code}`, { ...e.params, column: e.column ?? '' } as Record<string, string>);
  const where = (e: ImportError) =>
    e.row === 0 ? '' : e.column ? t('import.rowColumn', { row: e.row, column: e.column }) : t('import.row', { row: e.row });

  return (
    <div className="screen-overlay" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <section className="dv-panel import">
        <h2 className="dv-panel__title" id="import-title">
          {t('import.title')}
        </h2>
        <button type="button" className="dv-btn dv-btn--icon dv-panel__close" aria-label={t('common.close')} onClick={onClose}>
          <span className="dv-ico dv-ico--close" aria-hidden />
        </button>

        {step.kind !== 'applied' && (
          <div
            className={`dv-file${over ? ' is-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <span className="dv-ico dv-ico--upload dv-ico--lg" aria-hidden />
            <span className="dv-file__text">
              {step.kind === 'idle' ? t('import.dropHint') : step.kind === 'reading' ? t('import.reading') : t('import.file', { name: step.name })}
            </span>
            <button type="button" className="dv-btn" onClick={() => input.current?.click()}>
              {t('common.chooseFile')}
            </button>
            <input
              ref={input}
              type="file"
              hidden
              accept=".csv,.xlsx,.xls,.json,text/csv,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void read(f);
              }}
            />
          </div>
        )}

        {step.kind === 'errors' && (
          <div className="import__body">
            <p className="import__lead">{t('import.errorsTitle')}</p>
            <ul className="import__errors">
              {step.errors.map((e, i) => (
                <li key={i} className="dv-field__error">
                  <span className="dv-ico dv-ico--warn" aria-hidden />
                  <span>
                    {where(e) && <span className="import__where">{where(e)}: </span>}
                    {errorText(e)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step.kind === 'preview' && (
          <div className="import__body">
            <p className="import__lead">
              {step.summary.newDisciplines + step.summary.newLabs + step.summary.updatedLabs + step.summary.newlyDone + step.summary.newlyGraded === 0
                ? t('import.nothingNew')
                : t('import.summary', { ...step.summary })}
            </p>
            {step.summary.newlyDone + step.summary.newlyGraded > 0 && (
              <p className="dv-caption">{t('import.retro', { done: step.summary.newlyDone, graded: step.summary.newlyGraded })}</p>
            )}
            <div className="import__pages">
              {step.plan.disciplines.map((d) => {
                const labs = Object.values(step.curriculum.labs)
                  .filter((l) => l.disciplineKey === d.key)
                  .sort((a, b) => a.labNo - b.labNo);
                const pack = getPack(d.pack);
                return (
                  <article key={d.key} className="dv-page import__page">
                    <h3 className="dv-page__title">{d.name}</h3>
                    <p className="dv-page__sub">
                      {pack.location.name.uk} · {t('import.labsCount', { count: labs.length })} ·{' '}
                      {d.hasExam && d.examDate ? t('import.exam', { date: dayMonth(d.examDate) }) : t('import.noExam')}
                    </p>
                    {labs.map((l) => (
                      <div key={l.key} className="dv-lab">
                        <span className="dv-lab__name">
                          {t('common.lab', { n: l.labNo })}
                          {l.title ? ` · ${l.title}` : ''}
                        </span>
                        <span className="dv-lab__meta">
                          <span className="dv-ico dv-ico--calendar" aria-hidden />
                          {l.deadline ? t('common.until', { date: dayMonth(l.deadline) }) : '—'}
                        </span>
                        <span className="dv-lab__status">
                          <LabStatus lab={l} thresholds={thresholds} />
                        </span>
                      </div>
                    ))}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {step.kind === 'applied' && (
          <div className="import__body">
            <p className="import__lead">{t('import.applied')}</p>
            {step.rewards > 0 && <p>{t('import.appliedRewards', { count: step.rewards })}</p>}
          </div>
        )}

        <div className="import__actions">
          {step.kind !== 'applied' && (
            <button type="button" className="dv-btn" onClick={() => downloadText('plan-template.csv', templateCsv(), 'text/csv;charset=utf-8')}>
              {t('import.template')}
            </button>
          )}
          <span className="import__spacer" />
          {step.kind === 'applied' ? (
            <button type="button" className="dv-btn dv-btn--primary" onClick={onClose}>
              {t('common.continue')}
            </button>
          ) : (
            <>
              <button type="button" className="dv-btn" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button type="button" className="dv-btn dv-btn--primary" disabled={step.kind !== 'preview'} onClick={() => void apply()}>
                {t('common.apply')}
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
