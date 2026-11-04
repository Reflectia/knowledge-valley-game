import { useTranslation } from 'react-i18next';

import { Ico, Panel } from '../components/common';
import { showToast } from '../components/Toasts';
import { useGame, useGameApi } from '../GameContext';

/** Esc menu in the game. «Лягти спати» ends the day until beds arrive with the homestead (stage 5). */
export function GameMenu({
  onClose,
  onJournal,
  onImport,
  onSettings,
  onTitle,
}: {
  onClose: () => void;
  onJournal: () => void;
  onImport: () => void;
  onSettings: () => void;
  onTitle: () => void;
}) {
  const { t } = useTranslation();
  const sleep = useGame((s) => s.sleep);
  const api = useGameApi();

  return (
    <Panel title={t('menu.title')} onClose={onClose} labelledBy="menu-title" className="game-menu">
      <div className="game-menu__list">
        <button type="button" className="dv-btn dv-btn--primary dv-btn--wide" onClick={onClose}>
          <Ico name="spark" />
          {t('menu.resume')}
        </button>
        <button type="button" className="dv-btn dv-btn--wide" onClick={onJournal}>
          <Ico name="book" />
          {t('menu.journal')}
        </button>
        <button type="button" className="dv-btn dv-btn--wide" onClick={onImport}>
          <Ico name="upload" />
          {t('menu.importPlan')}
        </button>
        <button type="button" className="dv-btn dv-btn--wide" onClick={onSettings}>
          <Ico name="gear" />
          {t('menu.settings')}
        </button>
        <button
          type="button"
          className="dv-btn dv-btn--wide"
          onClick={async () => {
            await sleep();
            showToast({ icon: 'clock', title: t('menu.slept', { day: api.getState().world.state.day }) });
            onClose();
          }}
        >
          <Ico name="clock" />
          {t('menu.sleep')}
        </button>
        <button type="button" className="dv-btn dv-btn--wide" onClick={onTitle}>
          <Ico name="close" />
          {t('menu.toTitle')}
        </button>
      </div>
    </Panel>
  );
}
