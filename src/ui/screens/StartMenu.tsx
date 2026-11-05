import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Ico, Overlay, Panel, FileButton, useEscape } from '../components/common';
import { useGame } from '../GameContext';

const VERSION = '0.1';
const ART = `${import.meta.env.BASE_URL}assets/ui/`;

/**
 * Start screen (spec §8 screen 1): the owner's valley backdrop, title art and a
 * stone-and-vine panel (start-menu-*-new.jpg). The sword marks the hovered item,
 * or the default one («Продовжити» with a save, else «Нова гра»).
 */
export function StartMenu({
  onContinue,
  onNewGame,
  onSettings,
}: {
  onContinue: () => void;
  onNewGame: () => void;
  onSettings: () => void;
}) {
  const { t } = useTranslation();
  const ready = useGame((s) => s.ready);
  const hasSave = useGame((s) => s.hasSave);
  const importSave = useGame((s) => s.importSave);
  const [dialog, setDialog] = useState<null | 'overwrite' | 'language' | { error: string }>(null);

  async function onImport(file: File) {
    try {
      await importSave(await file.text());
      onContinue();
    } catch (e) {
      setDialog({ error: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="start-screen">
      <div className="dv-start">
        <img className="dv-start__bg" src={`${ART}start-bg.png`} alt="" />
        <h1 className="start-menu__title">
          <img src={`${ART}start-title.png`} alt={t('game.title')} />
        </h1>
        <nav className="start-menu__panel" aria-label={t('game.title')}>
          {hasSave && (
            <button type="button" className="start-menu__item is-default" disabled={!ready} onClick={onContinue}>
              {t('start.continue')}
            </button>
          )}
          <button
            type="button"
            className={`start-menu__item${hasSave ? '' : ' is-default'}`}
            disabled={!ready}
            onClick={() => (hasSave ? setDialog('overwrite') : onNewGame())}
          >
            {t('start.newGame')}
          </button>
          <FileButton
            className="start-menu__item"
            label={t('start.importSave')}
            accept=".json,application/json"
            onFile={(f) => void onImport(f)}
          />
          <button type="button" className="start-menu__item" onClick={onSettings}>
            {t('start.settings')}
          </button>
          <button type="button" className="start-menu__item" onClick={() => setDialog('language')}>
            {t('start.language')}
          </button>
        </nav>
        <span className="dv-start__ver">{t('start.version', { version: VERSION })}</span>
      </div>

      {dialog && <StartDialog dialog={dialog} onClose={() => setDialog(null)} onOverwrite={onNewGame} />}
    </div>
  );
}

function StartDialog({
  dialog,
  onClose,
  onOverwrite,
}: {
  dialog: 'overwrite' | 'language' | { error: string };
  onClose: () => void;
  onOverwrite: () => void;
}) {
  const { t } = useTranslation();
  useEscape(onClose);
  if (dialog === 'overwrite') {
    return (
      <Overlay dim>
        <Panel title={t('start.overwriteTitle')} onClose={onClose} labelledBy="overwrite-title" className="small-dialog">
          <p>{t('start.overwriteBody')}</p>
          <div className="dialog-actions">
            <button type="button" className="dv-btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="button" className="dv-btn dv-btn--primary" onClick={onOverwrite}>
              {t('start.overwrite')}
            </button>
          </div>
        </Panel>
      </Overlay>
    );
  }
  if (dialog === 'language') {
    return (
      <Overlay dim>
        <Panel title={t('settings.language')} onClose={onClose} labelledBy="language-title" className="small-dialog">
          <LanguageToggle />
          <p className="dv-caption">{t('start.languageSoon')}</p>
        </Panel>
      </Overlay>
    );
  }
  return (
    <Overlay dim>
      <Panel title={t('start.importSave')} onClose={onClose} labelledBy="import-error-title" className="small-dialog">
        <p className="dv-field__error">
          <Ico name="warn" />
          {t('start.importFailed', { reason: dialog.error })}
        </p>
        <div className="dialog-actions">
          <button type="button" className="dv-btn dv-btn--primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </Panel>
    </Overlay>
  );
}

/** УКР / ENG (LanguageToggle README). v0.1 is Ukrainian only, so ENG is disabled. */
export function LanguageToggle() {
  const { t } = useTranslation();
  return (
    <div className="dv-lang">
      <Ico name="globe" />
      <span className="dv-lang__group" role="group" aria-label={t('settings.language')}>
        <button type="button" className="dv-btn" aria-pressed="true">
          УКР
        </button>
        <button type="button" className="dv-btn" aria-pressed="false" disabled title={t('start.languageSoon')}>
          ENG
        </button>
      </span>
    </div>
  );
}
