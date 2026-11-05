import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { sfx } from '@/audio';
import type { RarityThresholds, UiScale, Volume } from '@/core/types';

import { FileButton, Ico, Panel } from '../components/common';
import { showToast } from '../components/Toasts';
import { useGame } from '../GameContext';
import { downloadText } from '../format';
import { LanguageToggle } from './StartMenu';

type Tab = 'sound' | 'game' | 'save';

/** Settings (spec §8 screen 11): volume, language, rarity thresholds, save export/import. */
export function SettingsScreen({ onClose, onImportPlan }: { onClose: () => void; onImportPlan?: () => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('sound');
  const tabs: { id: Tab; icon: string }[] = [
    { id: 'sound', icon: 'sound' },
    { id: 'game', icon: 'gear' },
    { id: 'save', icon: 'upload' },
  ];
  return (
    <div className="settings-wrap">
      <div className="dv-tabs" role="tablist">
        {tabs.map((x) => (
          <button key={x.id} type="button" role="tab" className="dv-tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}>
            <Ico name={x.icon} />
            {t(`settings.tabs.${x.id}`)}
          </button>
        ))}
      </div>
      <Panel title={t('settings.title')} onClose={onClose} labelledBy="settings-title" className="settings">
        {tab === 'sound' && <SoundTab />}
        {tab === 'game' && <GameTab />}
        {tab === 'save' && <SaveTab onImportPlan={onImportPlan} />}
      </Panel>
    </div>
  );
}

function SoundTab() {
  const { t } = useTranslation();
  const volume = useGame((s) => s.labs.settings.volume);
  const update = useGame((s) => s.updateSettings);
  const rows: { id: keyof Volume; icon: string }[] = [
    { id: 'master', icon: 'sound' },
    { id: 'music', icon: 'sound' },
    { id: 'sfx', icon: 'sound' },
  ];
  return (
    <div className="settings__section">
      {rows.map((r) => (
        <label key={r.id} className="dv-slider">
          <span className="dv-slider__label">
            <Ico name={r.icon} />
            {t(`settings.volume.${r.id}`)}
          </span>
          <input
            className="dv-range"
            type="range"
            min={0}
            max={100}
            step={5}
            value={volume[r.id]}
            style={{ '--value': `${volume[r.id]}%` } as CSSProperties}
            onChange={(e) => void update({ volume: { ...volume, [r.id]: Number(e.target.value) } })}
            // A sample when the slider is let go, to hear the new level.
            onPointerUp={() => r.id !== 'music' && sfx('harvest')}
            onKeyUp={() => r.id !== 'music' && sfx('harvest')}
            onWheel={(e) => {
              const v = Math.max(0, Math.min(100, volume[r.id] + (e.deltaY < 0 ? 5 : -5)));
              void update({ volume: { ...volume, [r.id]: v } });
            }}
          />
          <span className="dv-slider__value">{volume[r.id]}%</span>
        </label>
      ))}
    </div>
  );
}

function GameTab() {
  const { t } = useTranslation();
  const settings = useGame((s) => s.labs.settings);
  const update = useGame((s) => s.updateSettings);
  const scales: UiScale[] = ['auto', 2, 3, 4];
  const pct = (x: number) => String(Math.round(x * 100));
  const [draft, setDraft] = useState({
    rare: pct(settings.rarityThresholds.rare),
    epic: pct(settings.rarityThresholds.epic),
    legendary: pct(settings.rarityThresholds.legendary),
  });
  const nums = { rare: Number(draft.rare), epic: Number(draft.epic), legendary: Number(draft.legendary) };
  const valid =
    Object.values(nums).every((n) => Number.isFinite(n) && n > 0) && nums.rare < nums.epic && nums.epic < nums.legendary && nums.legendary <= 100;
  const changed = (Object.keys(nums) as (keyof RarityThresholds)[]).some((k) => pct(settings.rarityThresholds[k]) !== draft[k]);

  return (
    <div className="settings__section">
      <div className="settings__row">
        <span className="dv-field__label">{t('settings.language')}</span>
        <LanguageToggle />
      </div>
      <div className="settings__row">
        <span className="dv-field__label">{t('settings.uiScale')}</span>
        <span className="dv-lang__group" role="group" aria-label={t('settings.uiScale')}>
          {scales.map((s) => (
            <button key={s} type="button" className="dv-btn" aria-pressed={settings.uiScale === s} onClick={() => void update({ uiScale: s })}>
              {s === 'auto' ? t('settings.scaleAuto') : `×${s}`}
            </button>
          ))}
        </span>
      </div>
      <form
        className={`dv-field${valid ? '' : ' is-error'}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          void update({ rarityThresholds: { rare: nums.rare / 100, epic: nums.epic / 100, legendary: nums.legendary / 100 } });
          showToast({ icon: 'check', title: t('settings.applied') });
        }}
      >
        <span className="dv-field__label">{t('settings.rarity')}</span>
        <span className="dv-field__row settings__rarity">
          {(['rare', 'epic', 'legendary'] as const).map((k) => (
            <label key={k} className={`settings__threshold dv-rarity--${k}`}>
              <Ico name={`r-${k}`} />
              <span>{t(`rarity.${k}`)}</span>
              <input
                className="dv-input dv-input--num"
                type="number"
                min={1}
                max={100}
                value={draft[k]}
                onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
              />
            </label>
          ))}
          <button type="submit" className="dv-btn" disabled={!valid || !changed}>
            {t('common.save')}
          </button>
        </span>
        {valid ? (
          <span className="dv-field__help">{t('settings.rarityHelp', nums)}</span>
        ) : (
          <span className="dv-field__error">
            <Ico name="warn" />
            {t('settings.rarityOrder')}
          </span>
        )}
      </form>
    </div>
  );
}

function SaveTab({ onImportPlan }: { onImportPlan?: () => void }) {
  const { t } = useTranslation();
  const lastExportAt = useGame((s) => s.labs.settings.lastExportAt);
  const exportSave = useGame((s) => s.exportSave);
  const importSave = useGame((s) => s.importSave);
  const [pending, setPending] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doExport = () => {
    const json = exportSave();
    const date = new Date().toISOString().slice(0, 10);
    downloadText(`knowledge-valley-${date}.json`, json, 'application/json');
  };

  return (
    <div className="settings__section">
      <div className="settings__block">
        <button type="button" className="dv-btn dv-btn--primary" onClick={doExport}>
          <Ico name="upload" />
          {t('settings.export')}
        </button>
        <p className="dv-field__help">{t('settings.exportHelp')}</p>
        <p className="dv-caption">
          {lastExportAt
            ? t('settings.lastExport', { date: new Date(lastExportAt).toLocaleDateString('uk-UA') })
            : t('settings.neverExported')}
        </p>
      </div>
      <div className="settings__block">
        {pending ? (
          <>
            <p>{t('settings.importConfirm')}</p>
            <div className="dialog-actions">
              <button type="button" className="dv-btn" onClick={() => setPending(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="dv-btn"
                onClick={async () => {
                  try {
                    await importSave(await pending.text());
                    setError(null);
                    showToast({ icon: 'check', title: t('settings.imported') });
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                  setPending(null);
                }}
              >
                {t('common.yes')}
              </button>
            </div>
          </>
        ) : (
          <FileButton label={t('settings.import')} accept=".json,application/json" onFile={(f) => setPending(f)} />
        )}
        <p className="dv-field__help">{t('settings.importHelp')}</p>
        {error && (
          <p className="dv-field__error">
            <Ico name="warn" />
            {t('settings.importFailed', { reason: error })}
          </p>
        )}
      </div>
      {onImportPlan && (
        <div className="settings__block">
          <button type="button" className="dv-btn" onClick={onImportPlan}>
            <Ico name="book" />
            {t('menu.importPlan')}
          </button>
        </div>
      )}
    </div>
  );
}
