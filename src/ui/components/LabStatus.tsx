import { useTranslation } from 'react-i18next';

import { BALANCE } from '@/core/content';
import { isOnTime, rarityFor } from '@/core/rules';
import type { Lab, RarityThresholds } from '@/core/types';

import { dayMonth, scoreText } from '../format';

/** Status chips of a lab: always icon + word (JournalPage README). */
export function LabStatus({ lab, thresholds = BALANCE.rarityThresholds }: { lab: Lab; thresholds?: RarityThresholds }) {
  const { t } = useTranslation();
  if (!lab.doneDate) {
    return (
      <span className="dv-chip dv-chip--todo">
        <span className="dv-ico dv-ico--clock" aria-hidden />
        {t('status.todo')}
      </span>
    );
  }
  const late = !isOnTime(lab);
  const rarity = lab.score !== undefined && lab.maxScore !== undefined ? rarityFor(lab.score, lab.maxScore, thresholds) : null;
  return (
    <>
      <span className="dv-chip dv-chip--done">
        <span className="dv-ico dv-ico--check" aria-hidden />
        {t('status.done', { date: dayMonth(lab.doneDate) })}
      </span>
      {late && (
        <span className="dv-chip dv-chip--late">
          <span className="dv-ico dv-ico--clock" aria-hidden />
          {t('status.late')}
        </span>
      )}
      {rarity && (
        <span className={`dv-chip dv-chip--graded dv-rarity--${rarity}`}>
          <span className={`dv-ico dv-ico--r-${rarity}`} aria-hidden />
          {t('status.graded', {
            score: scoreText(lab.score!),
            max: scoreText(lab.maxScore!),
            rarity: t(`rarity.${rarity}`),
          })}
        </span>
      )}
    </>
  );
}
