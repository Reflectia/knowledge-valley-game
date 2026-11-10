import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { sfx } from '@/audio';
import { uniqueItem } from '@/core/content';
import { setToolbarSlot } from '@/core/homestead';
import { ITEMS, isConsumable, type ItemKind } from '@/core/items';

import { ItemIcon, uniqueIconUrl } from '../components/ItemIcon';
import { Ico, Panel } from '../components/common';
import { useGame } from '../GameContext';
import { scoreText } from '../format';
import { loc } from '@/i18n';

const GROUPS: { kind: ItemKind; key: string }[] = [
  { kind: 'tool', key: 'tools' },
  { kind: 'seed', key: 'seeds' },
  { kind: 'crop', key: 'crops' },
  { kind: 'resource', key: 'resources' },
  { kind: 'furniture', key: 'furniture' },
  { kind: 'potion', key: 'potions' },
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
  const drink = useGame((s) => s.drink);
  const [drinkNote, setDrinkNote] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const owned = Object.entries(inventory).filter(([id, n]) => n > 0 && ITEMS[id]);
  const shown = hover ?? picked;
  // A unique item is shown with its lab and rarity: hovered by its lab, picked by its item id.
  const shownUnique = shown?.startsWith('u:')
    ? uniques.find((u) => `u:${u.labKey}` === shown)
    : shown && ITEMS[shown]?.unique
      ? uniques.find((u) => u.itemId === shown)
      : undefined;
  const shownItem = shown && !shown.startsWith('u:') && !ITEMS[shown]?.unique ? ITEMS[shown] : undefined;

  return (
    <Panel title={t('inventory.title')} onClose={onClose} labelledBy="inventory-title" className="inventory">
      <div className="inventory__body">
        <div className="inventory__groups">
          {GROUPS.map((g) => {
            const items = owned.filter(([id]) => ITEMS[id].kind === g.kind && !ITEMS[id].unique);
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
                      aria-label={ITEMS[id].name}
                      data-tip={ITEMS[id].name}
                      onClick={() => setPicked(picked === id ? null : id)}
                      onMouseEnter={() => setHover(id)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(id)}
                      onBlur={() => setHover(null)}
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
                  // In the bag it can go to the toolbar and be placed in the house; on display it stays there.
                  const inBag = (inventory[u.itemId] ?? 0) > 0;
                  return (
                    <button
                      key={u.labKey}
                      type="button"
                      className={`dv-slot dv-slot--${u.rarity}${picked === u.itemId ? ' is-selected' : ''}${inBag ? '' : ' is-placed'}`}
                      aria-label={`${loc(info?.name) ?? ''}, ${t(`rarity.${u.rarity}`)}${inBag ? '' : `, ${t('inventory.onDisplay')}`}`}
                      aria-pressed={picked === u.itemId}
                      data-tip={loc(info?.name)}
                      data-tip-rarity={u.rarity}
                      onClick={() => inBag && setPicked(picked === u.itemId ? null : u.itemId)}
                      onMouseEnter={() => setHover(`u:${u.labKey}`)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(`u:${u.labKey}`)}
                      onBlur={() => setHover(null)}
                    >
                      {info && <img src={uniqueIconUrl(u.itemId, info.pack.uniqueIcon)} alt="" />}
                      <span className="dv-slot__badge">
                        <Ico name={`r-${u.rarity}`} />
                      </span>
                    </button>
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
              {shownItem.kind === 'potion' && shown === picked && (
                <button
                  type="button"
                  className="dv-btn dv-btn--primary inventory__drink"
                  onClick={() => {
                    const reason = drink(shownItem.id);
                    setDrinkNote(reason ? t(`alchemy.fail.${reason}`) : t('alchemy.drank', { name: shownItem.name }));
                    if (!reason) sfx('spell');
                  }}
                >
                  {t('alchemy.drink')}
                </button>
              )}
              {shownItem.kind === 'potion' && drinkNote && <p className="dv-tooltip__hint">{drinkNote}</p>}
            </>
          )}
          {shownUnique && (() => {
            const info = uniqueItem(shownUnique.itemId);
            const lab = curriculum.labs[shownUnique.labKey];
            const disc = lab ? curriculum.disciplines[lab.disciplineKey] : undefined;
            return (
              <>
                <p className="dv-tooltip__title">{loc(info?.name)}</p>
                <p className={`dv-tooltip__meta dv-rarity--${shownUnique.rarity}`}>
                  <Ico name={`r-${shownUnique.rarity}`} /> {t(`rarity.${shownUnique.rarity}`)}
                </p>
                <p className="dv-tooltip__hint">
                  {(inventory[shownUnique.itemId] ?? 0) > 0 ? t('inventory.placeUnique') : t('inventory.onDisplayHint')}
                </p>
                {lab && (
                  <p className="dv-tooltip__hint">
                    {t('inventory.fromLab', { n: lab.labNo, discipline: disc?.name ?? '' })}
                    {lab.score !== undefined ? ` · ${scoreText(lab.score)}/${scoreText(lab.maxScore!)}` : ''}
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
            aria-label={id ? ITEMS[id]?.name : t('hud.emptySlot', { n: i + 1 })}
            data-tip={id ? ITEMS[id]?.name : undefined}
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
