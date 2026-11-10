import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { sfx } from '@/audio';

import { PACKS, getPack, packByBranch, uniqueItem } from '@/core/content';
import { RARITIES, type Curriculum, type Rarity, type RewardEvent } from '@/core/types';

import { Ico, Overlay, assetUrl } from '../components/common';
import { uniqueIconUrl } from '../components/ItemIcon';
import { useGame } from '../GameContext';
import { scoreText } from '../format';
import { loc } from '@/i18n';

type Done = Extract<RewardEvent, { kind: 'done' }>;
type Graded = Extract<RewardEvent, { kind: 'graded' }>;

/**
 * Reward scene (spec §8 screen 7, RewardCard README): one card for one lab, or the
 * batch scene «Долина пам'ятає твої зусилля» when several labs reward at once.
 */
export function RewardScene({ events, onTake }: { events: RewardEvent[]; onTake: () => void }) {
  const curriculum = useGame((s) => s.labs.curriculum);
  const labs = new Set(events.map((e) => e.labKey));
  // One jingle per scene, for the rarest item in it (spec §8: a sound per rarity).
  const played = useRef<RewardEvent[] | null>(null);
  useEffect(() => {
    if (played.current === events) return;
    played.current = events;
    const top = events.reduce<Rarity>(
      (best, e) => (e.kind === 'graded' && RARITIES.indexOf(e.rarity) > RARITIES.indexOf(best) ? e.rarity : best),
      'common',
    );
    sfx(`reward-${top}`);
  }, [events]);
  return (
    <Overlay dim>
      {labs.size === 1 ? (
        <SingleReward events={events} curriculum={curriculum} onTake={onTake} />
      ) : (
        <BatchReward events={events} onTake={onTake} />
      )}
    </Overlay>
  );
}

function ItemSlot({ itemId, rarity, large = false }: { itemId: string; rarity: Rarity; large?: boolean }) {
  const { t } = useTranslation();
  const item = uniqueItem(itemId);
  const icon = item ? uniqueIconUrl(itemId, item.pack.uniqueIcon) : assetUrl('item-book');
  return (
    // Focusable so keyboard players can read the name in the tooltip too.
    <span
      className={`dv-slot dv-slot--${rarity}${large ? ' dv-slot--lg' : ''}`}
      tabIndex={0}
      role="img"
      aria-label={`${loc(item?.name) ?? ''}, ${t(`rarity.${rarity}`)}`}
      data-tip={loc(item?.name)}
      data-tip-rarity={rarity}
    >
      <img src={icon} alt="" />
      <span className="dv-slot__badge">
        <Ico name={`r-${rarity}`} />
      </span>
    </span>
  );
}

function DoneLines({ done }: { done: Done[] }) {
  const { t } = useTranslation();
  const branches = new Map<string, number>();
  let coins = 0;
  let shields = 0;
  const resources = new Map<string, number>();
  for (const d of done) {
    branches.set(d.branch, (branches.get(d.branch) ?? 0) + 1);
    coins += d.coins;
    shields += d.shieldCharges;
    for (const [id, n] of Object.entries(d.resources)) resources.set(id, (resources.get(id) ?? 0) + n);
  }
  const resourceName = (id: string) => loc(Object.values(PACKS).find((p) => p.resource.id === id)?.resource.name) ?? id;
  return (
    <ul className="reward__lines">
      {[...branches].map(([branch, n]) => (
        <li key={branch}>
          <Ico name="spark" />
          {t('reward.skillPoint', { count: n, branch: loc(packByBranch(branch)?.branch.name) ?? branch })}
        </li>
      ))}
      {coins > 0 && (
        <li>
          <Ico name="coin" />
          {t('reward.coins', { count: coins })}
        </li>
      )}
      {[...resources].map(([id, n]) => (
        <li key={id}>
          <Ico name="spark" />
          {t('reward.resource', { count: n, name: resourceName(id) })}
        </li>
      ))}
      {shields > 0 && (
        <li>
          <Ico name="check" />
          {t('reward.shield', { count: shields })}
        </li>
      )}
    </ul>
  );
}

function SingleReward({ events, curriculum, onTake }: { events: RewardEvent[]; curriculum: Curriculum; onTake: () => void }) {
  const { t } = useTranslation();
  const done = events.filter((e): e is Done => e.kind === 'done');
  const graded = events.find((e): e is Graded => e.kind === 'graded');
  const lab = curriculum.labs[events[0].labKey];
  const discipline = lab ? curriculum.disciplines[lab.disciplineKey] : undefined;
  const pack = discipline ? getPack(discipline.pack) : undefined;
  const item = graded ? uniqueItem(graded.itemId) : undefined;
  const late = done.length > 0 && !done[0].onTime;

  return (
    <section className="dv-panel dv-reward" role="dialog" aria-modal="true" aria-labelledby="reward-title">
      <p className="dv-reward__kicker">{graded ? t('reward.kickerGraded') : t('reward.kickerDone')}</p>
      {graded ? (
        <>
          <ItemSlot itemId={graded.itemId} rarity={graded.rarity} large />
          <h2 className="dv-reward__name" id="reward-title">
            {loc(item?.name)}
          </h2>
          <span className={`dv-reward__meta dv-rarity--${graded.rarity}`}>
            <Ico name={`r-${graded.rarity}`} />
            {t(`rarity.${graded.rarity}`)}
          </span>
          {lab && lab.score !== undefined && (
            <p className="dv-reward__text dv-caption">
              {t('reward.from', { n: lab.labNo, score: scoreText(lab.score), max: scoreText(lab.maxScore!) })}
            </p>
          )}
        </>
      ) : (
        <>
          <span className="dv-slot dv-slot--lg">
            {pack && <img src={assetUrl(`portrait-${pack.id}`)} alt="" className="reward__portrait" />}
          </span>
          <h2 className="dv-reward__name" id="reward-title">
            {lab ? t('common.lab', { n: lab.labNo }) : ''}
          </h2>
          {discipline && <p className="dv-reward__text dv-caption">{discipline.name}</p>}
        </>
      )}
      {done.length > 0 && (
        <>
          {done[0].onTime && <p className="dv-reward__meta reward__ontime">{t('reward.onTime')}</p>}
          <DoneLines done={done} />
          {late && <p className="dv-reward__text dv-caption">{t('reward.late')}</p>}
        </>
      )}
      <button type="button" className="dv-btn dv-btn--primary" autoFocus onClick={onTake}>
        {t('common.take')}
      </button>
    </section>
  );
}

const BATCH_SLOTS = 12;

function BatchReward({ events, onTake }: { events: RewardEvent[]; onTake: () => void }) {
  const { t } = useTranslation();
  const done = events.filter((e): e is Done => e.kind === 'done');
  const graded = events.filter((e): e is Graded => e.kind === 'graded');
  return (
    <section className="dv-panel dv-reward reward--batch" role="dialog" aria-modal="true" aria-labelledby="reward-title">
      <p className="dv-reward__kicker" id="reward-title">
        {t('reward.batchTitle')}
      </p>
      <p className="dv-reward__text">{t('reward.batchText')}</p>
      {graded.length > 0 && (
        <div className="dv-reward__list">
          {graded.slice(0, BATCH_SLOTS).map((g) => (
            <ItemSlot key={g.labKey} itemId={g.itemId} rarity={g.rarity} />
          ))}
          {graded.length > BATCH_SLOTS && <span className="dv-caption">{t('reward.more', { count: graded.length - BATCH_SLOTS })}</span>}
        </div>
      )}
      <DoneLines done={done} />
      <button type="button" className="dv-btn dv-btn--primary" autoFocus onClick={onTake}>
        {t('common.take')}
      </button>
    </section>
  );
}
