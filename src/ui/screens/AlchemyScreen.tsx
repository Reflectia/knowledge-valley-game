import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { sfx } from '@/audio';
import { BUFFS, knownRecipes, missing, POTIONS, type PotionDef } from '@/core/alchemy';
import { BALANCE, getPack } from '@/core/content';
import { count } from '@/core/homestead';
import { getItem } from '@/core/items';
import { loc } from '@/i18n';

import { ItemIcon } from '../components/ItemIcon';
import { Ico, Panel } from '../components/common';
import { useGame } from '../GameContext';

/**
 * The alchemy lab (spec §5 Science «Алхімія»): recipes known so far, what each needs and has,
 * and «Зварити». Unknown recipes show where to look for them.
 */
export function AlchemyScreen({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const world = useGame((s) => s.world.state);
  const brew = useGame((s) => s.brew);
  const [message, setMessage] = useState<string | null>(null);
  const known = knownRecipes(world);
  const unknown = POTIONS.filter((p) => !known.includes(p));
  const cost = BALANCE.actions.brew.energy;

  const onBrew = (p: PotionDef) => {
    const reason = brew(p.id);
    if (reason) setMessage(t(`alchemy.fail.${reason}`));
    else {
      sfx('spell');
      setMessage(t('alchemy.brewed', { name: getItem(p.id).name }));
    }
  };

  return (
    <Panel title={t('alchemy.title')} onClose={onClose} labelledBy="alchemy-title" className="alchemy">
      <p className="dv-caption">{t('alchemy.hint', { energy: cost })}</p>
      <ul className="alchemy__list">
        {known.map((p) => {
          const lack = missing(world, p);
          const ready = Object.keys(lack).length === 0;
          const item = getItem(p.id);
          return (
            <li key={p.id} className="alchemy__recipe">
              <ItemIcon id={p.id} />
              <div className="alchemy__text">
                <p className="alchemy__name">
                  {item.name}
                  {count(world, p.id) > 0 && <span className="dv-caption"> · {t('alchemy.have', { count: count(world, p.id) })}</span>}
                </p>
                <p className="dv-caption">{p.effect.buff ? `${BUFFS[p.effect.buff].name}: ${BUFFS[p.effect.buff].text}` : item.text}</p>
                <ul className="alchemy__needs" aria-label={t('alchemy.needs')}>
                  {Object.entries(p.recipe).map(([id, n]) => (
                    <li key={id} className={lack[id] ? 'is-missing' : ''} data-tip={getItem(id).name}>
                      <ItemIcon id={id} scale={1} />
                      <span>
                        {getItem(id).name} {Math.min(count(world, id), n)}/{n}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <button type="button" className="dv-btn dv-btn--primary" disabled={!ready} onClick={() => onBrew(p)}>
                <Ico name="spark" />
                {t('alchemy.brew')}
              </button>
            </li>
          );
        })}
        {unknown.map((p) => (
          <li key={p.id} className="alchemy__recipe is-unknown">
            <span className="alchemy__unknown" aria-hidden="true">
              ?
            </span>
            <div className="alchemy__text">
              <p className="alchemy__name">{t('alchemy.unknown')}</p>
              <p className="dv-caption">{t('alchemy.where', { place: p.pack ? loc(getPack(p.pack).location.name) : '' })}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="alchemy__message dv-caption" aria-live="polite">
        {message}
      </p>
    </Panel>
  );
}
