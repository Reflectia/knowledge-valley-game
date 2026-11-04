import { useTranslation } from 'react-i18next';

import type { SleepReason } from '@/state/store';

import { Ico, Overlay, Panel } from '../components/common';

/**
 * End of the day: the bed asks first; 02:00 and empty energy just explain.
 * Sleeping saves the world (nightly autosave, spec §4).
 */
export function SleepDialog({ reason, onSleep, onStay }: { reason: SleepReason; onSleep: () => void; onStay: () => void }) {
  const { t } = useTranslation();
  const title = reason === 'bed' ? t('sleep.bedTitle') : reason === 'late' ? t('sleep.lateTitle') : t('sleep.tiredTitle');
  const text = reason === 'bed' ? t('sleep.bedText') : reason === 'late' ? t('sleep.lateText') : t('sleep.tiredText');
  return (
    <Overlay dim>
      <Panel title={title} onClose={reason === 'bed' ? onStay : undefined} labelledBy="sleep-title" className="small-dialog">
        <p>
          <Ico name="clock" /> {text}
        </p>
        <div className="dialog-actions">
          {reason === 'bed' && (
            <button type="button" className="dv-btn" onClick={onStay}>
              {t('sleep.stay')}
            </button>
          )}
          <button type="button" className="dv-btn dv-btn--primary" autoFocus onClick={onSleep}>
            {reason === 'bed' ? t('sleep.go') : t('sleep.ok')}
          </button>
        </div>
      </Panel>
    </Overlay>
  );
}
