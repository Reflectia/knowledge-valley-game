import { useTranslation } from 'react-i18next';

import { useGameStore } from '@/state/store';

/** Stage 0 placeholder UI: one design-system panel to verify tokens, fonts and frames. */
export function App() {
  const { t } = useTranslation();
  const clicks = useGameStore((s) => s.debugClicks);
  const increment = useGameStore((s) => s.incrementDebugClicks);

  return (
    <div className="dv dv-ui app-ui" data-scale="2">
      <section className="dv-panel" style={{ maxWidth: 560 }}>
        <h2 className="dv-panel__title">{t('dev.scaffoldTitle')}</h2>
        <p>{t('dev.scaffoldBody')}</p>
        <p>{t('dev.clicks', { count: clicks })}</p>
        <button type="button" className="dv-btn dv-btn--primary" onClick={increment}>
          {t('common.continue')}
        </button>
      </section>
    </div>
  );
}
