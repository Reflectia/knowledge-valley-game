import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Ico, Overlay, Panel, FileButton, useEscape } from '../components/common';
import { useGame } from '../GameContext';

const VERSION = '0.1';
const BACKDROP = `${import.meta.env.BASE_URL}assets/ui/start-bg-640x360.png`;

/**
 * Start screen (spec §8 screen 1, StartMenu README): static valley backdrop,
 * game title and five buttons; «Продовжити» is the primary one when a save exists.
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
        <img className="dv-start__bg" src={BACKDROP} alt="" />
        <h1 className="dv-start__logo">{t('game.title')}</h1>
        <nav className="dv-start__menu" aria-label={t('game.title')}>
          {hasSave && (
            <button type="button" className="dv-btn dv-btn--primary dv-btn--wide" disabled={!ready} onClick={onContinue}>
              <Ico name="spark" />
              {t('start.continue')}
            </button>
          )}
          <button
            type="button"
            className={`dv-btn dv-btn--wide${hasSave ? '' : ' dv-btn--primary'}`}
            disabled={!ready}
            onClick={() => (hasSave ? setDialog('overwrite') : onNewGame())}
          >
            <Ico name="book" />
            {t('start.newGame')}
          </button>
          <span className="start-screen__file">
            <FileButton
              label={
                <>
                  <Ico name="upload" />
                  {t('start.importSave')}
                </>
              }
              accept=".json,application/json"
              onFile={(f) => void onImport(f)}
            />
          </span>
          <button type="button" className="dv-btn dv-btn--wide" onClick={onSettings}>
            <Ico name="gear" />
            {t('start.settings')}
          </button>
          <button type="button" className="dv-btn dv-btn--wide" onClick={() => setDialog('language')}>
            <Ico name="globe" />
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
