import { useTranslation } from 'react-i18next';

import type { DefeatLoss } from '@/core/combat';
import { getItem } from '@/core/items';
import type { SleepReason } from '@/state/store';

import { Ico, Overlay, Panel, useEscape } from '../components/common';

/**
 * End of the day: the bed asks first; 02:00 and empty energy just explain.
 * Sleeping saves the world (nightly autosave, spec §4).
 */
export function SleepDialog({
  reason,
  lost,
  onSleep,
  onStay,
}: {
  reason: SleepReason;
  lost?: DefeatLoss | null;
  onSleep: () => void;
  onStay: () => void;
}) {
  const { t } = useTranslation();
  // Esc means «stay up» at the bed (like the close button); forced sleep has nothing to cancel.
  useEscape(() => {
    if (reason === 'bed') onStay();
  });
  const title = t(`sleep.${reason}Title`);
  const text = t(`sleep.${reason}Text`);
  const lostList = lost
    ? [
        ...(lost.coins > 0 ? [t('sleep.coins', { count: lost.coins })] : []),
        ...Object.entries(lost.items).map(([id, n]) => `${getItem(id).name} ×${n}`),
      ]
    : [];
  return (
    <Overlay dim>
      <Panel title={title} onClose={reason === 'bed' ? onStay : undefined} labelledBy="sleep-title" className="small-dialog">
        <p>
          <Ico name={reason === 'defeat' ? 'heart' : 'clock'} /> {text}
        </p>
        {reason === 'defeat' && (
          <p className="dv-caption">{lostList.length ? t('sleep.defeatLost', { list: lostList.join(', ') }) : t('sleep.defeatNothing')}</p>
        )}
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
