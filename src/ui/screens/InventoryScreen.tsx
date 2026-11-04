import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { uniqueItem } from '@/core/content';
import { setToolbarSlot } from '@/core/homestead';
import { ITEMS, isConsumable, type ItemKind } from '@/core/items';

import { ItemIcon } from '../components/ItemIcon';
import { Ico, Panel, assetUrl } from '../components/common';
import { useGame } from '../GameContext';
import { scoreText } from '../format';

const GROUPS: { kind: ItemKind; key: string }[] = [
  { kind: 'tool', key: 'tools' },
  { kind: 'seed', key: 'seeds' },
  { kind: 'crop', key: 'crops' },
  { kind: 'resource', key: 'resources' },
  { kind: 'furniture', key: 'furniture' },
];

/**
 * Bag (spec §8 screen 4): everything carried, grouped; pick an item, then a toolbar
 * slot to put it there. Unique lab items are shown with their rarity frame.
 */
export function InventoryScreen({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const inventory = useGame((s) => s.world.state.inventory);
  const toolbar = useGame((s) => s.world.state.toolbar);
  const uniques = useGame((s) => s.progress.uniques);
  const curriculum = useGame((s) => s.labs.curriculum);
  const editWorld = useGame((s) => s.editWorld);
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const owned = Object.entries(inventory).filter(([id, n]) => n > 0 && ITEMS[id]);
  const shown = hover ?? picked;
  const shownItem = shown && !shown.startsWith('u:') ? ITEMS[shown] : undefined;
  const shownUnique = shown?.startsWith('u:') ? uniques.find((u) => `u:${u.labKey}` === shown) : undefined;

  return (
    <Panel title={t('inventory.title')} onClose={onClose} labelledBy="inventory-title" className="inventory">
      <div className="inventory__body">
        <div className="inventory__groups">
          {GROUPS.map((g) => {
            const items = owned.filter(([id]) => ITEMS[id].kind === g.kind);
            if (!items.length) return null;
            return (
              <section key={g.kind} className="inventory__group">
                <h3 className="inventory__heading">{t(`inventory.${g.key}`)}</h3>
                <div className="inventory__grid">
                  {items.map(([id, n]) => (
                    <button
                      key={id}
                      type="button"
                      className={`dv-slot${picked === id ? ' is-selected' : ''}`}
                      title={ITEMS[id].name}
                      onClick={() => setPicked(picked === id ? null : id)}
                      onMouseEnter={() => setHover(id)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <ItemIcon id={id} />
                      {isConsumable(id) && <span className="dv-slot__count">{n}</span>}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
          <section className="inventory__group">
            <h3 className="inventory__heading">{t('inventory.uniques')}</h3>
            {uniques.length === 0 ? (
              <p className="dv-caption">{t('inventory.uniquesEmpty')}</p>
            ) : (
              <div className="inventory__grid">
                {uniques.map((u) => {
                  const info = uniqueItem(u.itemId);
                  return (
                    <span
                      key={u.labKey}
                      className={`dv-slot dv-slot--${u.rarity}`}
                      title={info?.name.uk}
                      onMouseEnter={() => setHover(`u:${u.labKey}`)}
                      onMouseLeave={() => setHover(null)}
                    >
                      {info && <img src={assetUrl(info.pack.uniqueIcon)} alt={info.name.uk} />}
                      <span className="dv-slot__badge">
                        <Ico name={`r-${u.rarity}`} />
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="dv-tooltip inventory__info" aria-live="polite">
          {shownItem && (
            <>
              <p className="dv-tooltip__title">{shownItem.name}</p>
              <p className="dv-tooltip__text">{shownItem.text}</p>
              {shownItem.sell && <p className="dv-tooltip__hint">{t('inventory.sell', { price: shownItem.sell })}</p>}
              {shownItem.kind === 'furniture' && <p className="dv-tooltip__hint">{t('inventory.place')}</p>}
            </>
          )}
          {shownUnique && (() => {
            const info = uniqueItem(shownUnique.itemId);
            const lab = curriculum.labs[shownUnique.labKey];
            const disc = lab ? curriculum.disciplines[lab.disciplineKey] : undefined;
            return (
              <>
                <p className="dv-tooltip__title">{info?.name.uk}</p>
                <p className={`dv-tooltip__meta dv-rarity--${shownUnique.rarity}`}>
                  <Ico name={`r-${shownUnique.rarity}`} /> {t(`rarity.${shownUnique.rarity}`)}
                </p>
                {lab && (
                  <p className="dv-tooltip__hint">
                    {t('inventory.fromLab', { n: lab.labNo, discipline: disc?.name ?? '' })}
                    {lab.score !== undefined ? ` · ${scoreText(lab.score)}/${scoreText(lab.maxScore)}` : ''}
                  </p>
                )}
              </>
            );
          })()}
          {!shownItem && !shownUnique && <p className="dv-tooltip__hint">{t('inventory.slotHint')}</p>}
        </aside>
      </div>

      <div className="inventory__toolbar" aria-label={t('hud.toolbar')}>
        {toolbar.map((id, i) => (
          <button
            key={i}
            type="button"
            className={`dv-slot${picked ? ' is-target' : ''}`}
            title={id ? ITEMS[id]?.name : t('hud.emptySlot', { n: i + 1 })}
            onClick={() => {
              if (picked) {
                editWorld((w) => setToolbarSlot(w, i, picked));
                setPicked(null);
              } else if (id) {
                editWorld((w) => setToolbarSlot(w, i, null));
              }
            }}
          >
            {id && <ItemIcon id={id} />}
            <span className="hud__key">{i + 1}</span>
          </button>
        ))}
      </div>
      <p className="dv-caption">{picked ? t('inventory.toSlot') : t('inventory.slotHint')}</p>
    </Panel>
  );
}
