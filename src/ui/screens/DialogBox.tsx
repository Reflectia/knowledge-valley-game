import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getPack } from '@/core/content';
import type { Dialog } from '@/state/store';

import { assetUrl } from '../components/common';

/**
 * Mentor dialog at the bottom of the screen (DialogBox README): portrait ×2, name
 * plate and 1–2 lines; click the box or «Далі» for the next line.
 */
export function DialogBox({ dialog, onClose, onJournal }: { dialog: Dialog; onClose: () => void; onJournal: () => void }) {
  const { t } = useTranslation();
  const [i, setI] = useState(0);
  const pack = getPack(dialog.pack);
  const last = i >= dialog.lines.length - 1;
  const next = () => (last ? onClose() : setI(i + 1));

  return (
    <div className="dialog-layer">
      <section
        className="dv-panel dv-dialog"
        role="dialog"
        aria-label={pack.mentor.name.uk}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          if (!last) next();
        }}
      >
        <span className="dv-dialog__portrait">
          <img src={assetUrl(pack.mentor.portrait)} alt="" />
        </span>
        <div>
          <span className="dv-nameplate hud__name">{pack.mentor.name.uk}</span>
          <p className="dv-dialog__text" aria-live="polite">
            {dialog.lines[i]}
          </p>
          <div className="dv-dialog__next">
            {last ? (
              <>
                <button type="button" className="dv-btn" onClick={onJournal}>
                  {t('dialog.journal')}
                </button>
                <button type="button" className="dv-btn dv-btn--primary" autoFocus onClick={onClose}>
                  {t('dialog.bye')}
                </button>
              </>
            ) : (
              <button type="button" className="dv-btn dv-btn--primary" autoFocus onClick={next}>
                {t('dialog.next')}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
