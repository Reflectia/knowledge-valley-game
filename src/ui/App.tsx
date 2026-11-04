import { useTranslation } from 'react-i18next';

/** Stage 1 placeholder UI: a hint panel for the asset preview scene. */
export function App() {
  const { t } = useTranslation();

  return (
    <div className="dv dv-ui app-ui" data-scale="2">
      <section className="dv-panel" style={{ maxWidth: 520 }}>
        <h2 className="dv-panel__title">{t('dev.previewTitle')}</h2>
        <p>{t('dev.previewBody')}</p>
      </section>
    </div>
  );
}
