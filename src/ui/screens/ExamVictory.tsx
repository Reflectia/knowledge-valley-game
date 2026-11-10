import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { sfx } from '@/audio';
import { getPack } from '@/core/content';
import { bossFor } from '@/core/exam';
import { getItem } from '@/core/items';
import type { ExamVictory as Victory } from '@/state/store';
import { loc } from '@/i18n';

import { ItemIcon } from '../components/ItemIcon';
import { Ico, Overlay, assetUrl } from '../components/common';
import { useGame } from '../GameContext';

/**
 * An exam boss is beaten (spec §4): the trophy for the house, coins and experience, and the end
 * of the mentor's semester arc. Built like the reward card (RewardCard README).
 */
export function ExamVictory({ victory, onClose }: { victory: Victory; onClose: () => void }) {
  const { t } = useTranslation();
  const discipline = useGame((s) => s.labs.curriculum.disciplines[victory.disciplineKey]);
  const boss = bossFor(victory.pack);
  const pack = getPack(victory.pack);
  const trophy = boss ? getItem(boss.trophy) : undefined;

  useEffect(() => {
    sfx('reward-legendary');
  }, []);

  return (
    <Overlay dim>
      <section className="dv-panel dv-reward" role="dialog" aria-modal="true" aria-labelledby="exam-title">
        <p className="dv-reward__kicker">{t('exam.victory.kicker')}</p>
        <span className="dv-slot dv-slot--lg dv-slot--legendary">
          {trophy ? <ItemIcon id={trophy.id} scale={4} /> : <img src={assetUrl(`portrait-${pack.id}`)} alt="" />}
        </span>
        <h2 className="dv-reward__name" id="exam-title">
          {trophy?.name}
        </h2>
        {discipline && <p className="dv-reward__text dv-caption">{discipline.name}</p>}
        <p className="dv-reward__text">
          {t('exam.victory.text', { boss: boss?.name ?? '', mentor: loc(pack.mentor.name) })}
        </p>
        <ul className="reward__lines">
          <li>
            <Ico name="coin" />
            {t('reward.coins', { count: victory.coins })}
          </li>
          <li>
            <Ico name="spark" />
            {t('exam.victory.xp', { count: victory.xp })}
          </li>
        </ul>
        {trophy && <p className="dv-reward__text dv-caption">{t('exam.victory.trophy', { name: trophy.name })}</p>}
        <button type="button" className="dv-btn dv-btn--primary" autoFocus onClick={onClose}>
          {t('common.take')}
        </button>
      </section>
    </Overlay>
  );
}
