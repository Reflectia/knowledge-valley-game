import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGame } from './GameContext';
import { ImportScreen } from './screens/ImportScreen';

/** Temporary shell until stage 4: asset-preview hint and the plan import. */
export function App() {
  const { t } = useTranslation();
  const ready = useGame((s) => s.ready);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className="dv dv-ui app-ui" data-scale="2">
      <section className="dv-panel" style={{ maxWidth: 520 }}>
        <h2 className="dv-panel__title">{t('dev.previewTitle')}</h2>
        <p>{t('dev.previewBody')}</p>
        <button type="button" className="dv-btn dv-btn--primary" disabled={!ready} onClick={() => setImportOpen(true)}>
          <span className="dv-ico dv-ico--upload" aria-hidden />
          {t('import.open')}
        </button>
      </section>
      {importOpen && <ImportScreen onClose={() => setImportOpen(false)} />}
    </div>
  );
}
