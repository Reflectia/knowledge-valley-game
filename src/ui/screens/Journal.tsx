import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getPack } from '@/core/content';
import { examState, type ExamsWon } from '@/core/exam';
import { isOnTime, rarityFor, todayIso } from '@/core/rules';
import type { Lab } from '@/core/types';

import { LabStatus } from '../components/LabStatus';
import { Ico, Panel, tabPanelProps, tabProps } from '../components/common';
import { useGame } from '../GameContext';
import { dayMonth } from '../format';
import { loc } from '@/i18n';

type Edit = { key: string; mode: 'date' | 'score' } | null;

/** A stable empty record for the selector (a new {} each render would loop). */
const NO_EXAMS: ExamsWon = {};

/** Labs on the left page; the rest go to the right page (JournalPage README: 32 px rhythm). */
const LEFT_PAGE_LABS = 2;

/** Book journal (spec §8 screen 5): disciplines → labs, status, deadline, «Виконано» / «Ввести бал». */
export function Journal({ onClose, onImport }: { onClose: () => void; onImport: () => void }) {
  const { t } = useTranslation();
  const curriculum = useGame((s) => s.labs.curriculum);
  const progress = useGame((s) => s.progress);
  const won = useGame((s) => s.labs.exams ?? NO_EXAMS);

  const semesters = useMemo(
    () => [...new Set(Object.values(curriculum.disciplines).map((d) => d.semester))].sort((a, b) => b - a),
    [curriculum],
  );
  const [semester, setSemester] = useState(semesters[0] ?? 1);
  // Plan order (the import keeps the table's row order).
  const disciplines = Object.values(curriculum.disciplines).filter((d) => d.semester === semester);
  const [tab, setTab] = useState(0);
  const current = disciplines[Math.min(tab, disciplines.length - 1)];

  if (!current) {
    return (
      <Panel title={t('journal.title')} onClose={onClose} labelledBy="journal-title" className="journal">
        <div className="dv-book">
          <div className="dv-page journal__empty">
            <p>{t('journal.empty')}</p>
            <button type="button" className="dv-btn dv-btn--primary" onClick={onImport}>
              <Ico name="upload" />
              {t('journal.importPlan')}
            </button>
          </div>
        </div>
      </Panel>
    );
  }

  const labs = Object.values(curriculum.labs)
    .filter((l) => l.disciplineKey === current.key)
    .sort((a, b) => a.labNo - b.labNo);
  const p = progress.disciplines[current.key];
  const pack = getPack(current.pack);
  const exam = examState(current, p, todayIso(), won);

  return (
    <div className="journal-wrap">
      <div className="dv-tabs" role="tablist">
        {disciplines.map((d, i) => (
          <button
            key={d.key}
            type="button"
            className="dv-tab"
            {...tabProps('journal', i, disciplines.indexOf(current), disciplines.length, setTab)}
            // The tab shows the branch; the full discipline name is in the name and the tooltip.
            aria-label={`${loc(getPack(d.pack).branch.name)}: ${d.name}`}
            data-tip={d.name}
            onClick={() => setTab(i)}
          >
            <Ico name="book" />
            {loc(getPack(d.pack).branch.name)}
          </button>
        ))}
      </div>
      <Panel title={t('journal.title')} onClose={onClose} labelledBy="journal-title" className="journal">
        {semesters.length > 1 && (
          <div className="dv-lang__group journal__semesters">
            {semesters.map((s) => (
              <button key={s} type="button" className="dv-btn" aria-pressed={s === semester} onClick={() => { setSemester(s); setTab(0); }}>
                {t('journal.semester', { n: s })}
              </button>
            ))}
          </div>
        )}
        <div className="dv-book" {...tabPanelProps('journal', disciplines.indexOf(current))}>
          <article className="dv-page journal__page">
            <h3 className="dv-page__title">{current.name}</h3>
            <p className="dv-page__sub">
              {loc(pack.location.name)} · {t('journal.stage', { stage: p.revivalStage })} ·{' '}
              {p.buildingLevel > 0
                ? t('journal.building', { name: loc(pack.building.name), level: p.buildingLevel })
                : t('journal.buildingNone', { name: loc(pack.building.name) })}
            </p>
            {exam !== 'none' && (
              <p className={`dv-page__sub journal__exam journal__exam--${exam}`}>
                <Ico name={exam === 'won' ? 'check' : exam === 'ready' ? 'warn' : 'clock'} />
                {exam === 'won'
                  ? t('exam.status.won', { date: dayMonth(won[current.key].date) })
                  : exam === 'ready'
                    ? t('exam.status.ready', { place: loc(pack.location.name) })
                    : exam === 'date'
                      ? current.examDate
                        ? t('exam.status.date', { date: dayMonth(current.examDate) })
                        : t('exam.status.noDate')
                      : t('exam.status.labs')}
              </p>
            )}
            <LabList labs={labs.slice(0, LEFT_PAGE_LABS)} />
          </article>
          <article className="dv-page journal__page">
            <LabList labs={labs.slice(LEFT_PAGE_LABS)} />
          </article>
        </div>
      </Panel>
    </div>
  );
}

function LabList({ labs }: { labs: Lab[] }) {
  const [edit, setEdit] = useState<Edit>(null);
  return (
    <>
      {labs.map((lab) => (
        <LabRow
          key={lab.key}
          lab={lab}
          edit={edit?.key === lab.key ? edit.mode : null}
          onEdit={(mode) => setEdit(mode ? { key: lab.key, mode } : null)}
        />
      ))}
    </>
  );
}

function LabRow({ lab, edit, onEdit }: { lab: Lab; edit: 'date' | 'score' | null; onEdit: (m: 'date' | 'score' | null) => void }) {
  const { t } = useTranslation();
  const thresholds = useGame((s) => s.labs.settings.rarityThresholds);
  const row = useRef<HTMLDivElement>(null);
  const wasEditing = useRef(false);
  // When a form closes, its buttons are gone: put focus back on the lab's action (WCAG 2.4.3),
  // unless something else (the reward window) already has it.
  useEffect(() => {
    if (wasEditing.current && !edit) {
      const active = document.activeElement;
      if (!active || active === document.body || !active.isConnected || row.current?.contains(active)) {
        row.current?.querySelector<HTMLElement>('.dv-lab__actions button')?.focus();
      }
    }
    wasEditing.current = !!edit;
  }, [edit]);
  return (
    <div className="dv-lab" ref={row}>
      <span className="dv-lab__name">
        {t('common.lab', { n: lab.labNo })}
        {lab.title ? ` · ${lab.title}` : ''}
      </span>
      <span className="dv-lab__meta">
        <Ico name="calendar" />
        {lab.deadline ? t('common.until', { date: dayMonth(lab.deadline) }) : '—'}
      </span>
      <span className="dv-lab__status">
        <LabStatus lab={lab} thresholds={thresholds} />
      </span>
      {!edit && (
        <span className="dv-lab__actions">
          {!lab.doneDate ? (
            <button type="button" className="dv-btn dv-btn--primary" onClick={() => onEdit('date')}>
              {t('journal.markDone')}
            </button>
          ) : (
            <>
              <button type="button" className="dv-btn" onClick={() => onEdit('score')}>
                {lab.score === undefined ? t('journal.enterScore') : t('journal.changeScore')}
              </button>
              <button
                type="button"
                className="dv-btn dv-btn--icon"
                aria-label={t('journal.changeDate')}
                title={t('journal.changeDate')}
                onClick={() => onEdit('date')}
              >
                <Ico name="calendar" />
              </button>
            </>
          )}
        </span>
      )}
      {edit === 'date' && <DateForm lab={lab} onDone={() => onEdit(null)} />}
      {edit === 'score' && <ScoreForm lab={lab} onDone={() => onEdit(null)} />}
    </div>
  );
}

/** «Виконано»: done date, today by default, with the on-time consequence (DateField README). */
function DateForm({ lab, onDone }: { lab: Lab; onDone: () => void }) {
  const { t } = useTranslation();
  const markLabDone = useGame((s) => s.markLabDone);
  const unmarkLab = useGame((s) => s.unmarkLab);
  const [date, setDate] = useState(lab.doneDate ?? todayIso());
  const [confirmUndo, setConfirmUndo] = useState(false);
  const help = !lab.deadline
    ? t('journal.noDeadlineHelp')
    : isOnTime({ deadline: lab.deadline, doneDate: date })
      ? t('journal.onTimeHelp')
      : t('journal.lateHelp');

  if (confirmUndo) {
    return (
      <div className="journal__form">
        <p className="dv-field__help">{t('journal.undoConfirm')}</p>
        <div className="dv-page__actions">
          <button type="button" className="dv-btn" onClick={() => setConfirmUndo(false)}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="dv-btn dv-btn--primary"
            onClick={() => {
              void unmarkLab(lab.key);
              onDone();
            }}
          >
            {t('journal.undo')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="journal__form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!date) return;
        void markLabDone(lab.key, date);
        onDone();
      }}
    >
      <label className="dv-field">
        <span className="dv-field__label">{t('journal.doneDate')}</span>
        <span className="dv-field__row">
          <input className="dv-input dv-input--date" type="date" value={date} required autoFocus onChange={(e) => setDate(e.target.value)} />
        </span>
        <span className="dv-field__help">{help}</span>
      </label>
      <div className="dv-page__actions">
        <button type="submit" className="dv-btn dv-btn--primary">
          {lab.doneDate ? t('common.save') : t('journal.markDone')}
        </button>
        <button type="button" className="dv-btn" onClick={onDone}>
          {t('common.cancel')}
        </button>
        {lab.doneDate && (
          <button type="button" className="dv-btn" onClick={() => setConfirmUndo(true)}>
            {t('journal.undo')}
          </button>
        )}
      </div>
    </form>
  );
}

/** «Ввести бал» with the max next to it and a rarity forecast (ScoreField README). */
function ScoreForm({ lab, onDone }: { lab: Lab; onDone: () => void }) {
  const { t } = useTranslation();
  const setLabScore = useGame((s) => s.setLabScore);
  const thresholds = useGame((s) => s.labs.settings.rarityThresholds);
  const [text, setText] = useState(lab.score !== undefined ? String(lab.score) : '');
  if (lab.maxScore === undefined) {
    return (
      <div className="journal__form">
        <p className="dv-field__help">{t('journal.maxUnknown')}</p>
        <div className="dv-page__actions">
          <button type="button" className="dv-btn" onClick={onDone}>
            {t('common.cancel')}
          </button>
        </div>
      </div>
    );
  }
  const value = Number(text.replace(',', '.'));
  const valid = text.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= lab.maxScore;
  const tooHigh = Number.isFinite(value) && value > lab.maxScore;
  const rarity = valid ? rarityFor(value, lab.maxScore, thresholds) : null;
  const showError = text.trim() !== '' && !valid;

  return (
    <form
      className="journal__form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        void setLabScore(lab.key, value);
        onDone();
      }}
    >
      <label className={`dv-field${showError ? ' is-error' : ''}`}>
        <span className="dv-field__label">{t('journal.score')}</span>
        <span className="dv-field__row">
          <input
            className="dv-input dv-input--num"
            type="number"
            inputMode="decimal"
            min={0}
            max={lab.maxScore}
            step={0.5}
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
          />
          <span className="journal__max">{t('journal.outOf', { max: lab.maxScore })}</span>
        </span>
        {showError ? (
          <span className="dv-field__error">
            <Ico name="warn" />
            {tooHigh ? t('journal.scoreTooHigh', { max: lab.maxScore }) : t('journal.scoreBad', { max: lab.maxScore })}
          </span>
        ) : (
          <span className={`dv-field__help${rarity ? ` dv-rarity--${rarity}` : ''}`}>
            {rarity ? (
              <>
                <Ico name={`r-${rarity}`} /> {t('journal.scoreHelp', { rarity: t(`rarity.${rarity}`) })}
              </>
            ) : (
              ' '
            )}
          </span>
        )}
      </label>
      <div className="dv-page__actions">
        <button type="submit" className="dv-btn dv-btn--primary" disabled={!valid}>
          {t('common.save')}
        </button>
        <button type="button" className="dv-btn" onClick={onDone}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
