import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { buy, sell } from '@/core/homestead';
import { ITEMS, SHOP_BUY } from '@/core/items';

import { ItemIcon } from '../components/ItemIcon';
import { Ico, Panel } from '../components/common';
import { showToast } from '../components/Toasts';
import { useGame } from '../GameContext';

type Tab = 'buy' | 'sell';

/** The homestead shop: buy seeds and furniture, sell harvest and resources. */
export function ShopScreen({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('buy');
  const coins = useGame((s) => s.world.state.player.coins);
  const inventory = useGame((s) => s.world.state.inventory);
  const editWorld = useGame((s) => s.editWorld);

  const fail = (reason: string | null) => reason && showToast({ icon: 'warn', title: t(`world.fail.${reason}`) });
  const sellable = Object.entries(inventory).filter(([id, n]) => n > 0 && ITEMS[id]?.sell);

  return (
    <div className="shop-wrap">
      <div className="dv-tabs" role="tablist">
        {(['buy', 'sell'] as Tab[]).map((x) => (
          <button key={x} type="button" role="tab" className="dv-tab" aria-selected={tab === x} onClick={() => setTab(x)}>
            <Ico name={x === 'buy' ? 'coin' : 'spark'} />
            {t(`shop.${x}`)}
          </button>
        ))}
      </div>
      <Panel title={t('shop.title')} onClose={onClose} labelledBy="shop-title" className="shop">
        <p className="shop__coins">
          <Ico name="coin" /> {coins}
        </p>
        <ul className="shop__list">
          {tab === 'buy' &&
            SHOP_BUY.map((id) => {
              const item = ITEMS[id];
              return (
                <li key={id} className="shop__row">
                  <span className="dv-slot">
                    <ItemIcon id={id} />
                  </span>
                  <span className="shop__name">
                    <strong>{item.name}</strong>
                    <span className="dv-caption">{item.text}</span>
                  </span>
                  <span className="shop__price">
                    <Ico name="coin" /> {item.price}
                  </span>
                  <button
                    type="button"
                    className="dv-btn"
                    disabled={coins < (item.price ?? Infinity)}
                    onClick={() => {
                      const reason = editWorld((w) => buy(w, id));
                      if (reason) fail(reason);
                      else showToast({ icon: 'coin', title: t('shop.bought', { name: item.name }) }, 1500);
                    }}
                  >
                    {t('shop.buyOne')}
                  </button>
                </li>
              );
            })}
          {tab === 'sell' && sellable.length === 0 && <li className="dv-caption">{t('shop.nothingToSell')}</li>}
          {tab === 'sell' &&
            sellable.map(([id, n]) => {
              const item = ITEMS[id];
              const doSell = (qty: number) => {
                const reason = editWorld((w) => sell(w, id, qty));
                if (reason) fail(reason);
                else showToast({ icon: 'coin', title: t('shop.sold', { name: item.name, count: qty }) }, 1500);
              };
              return (
                <li key={id} className="shop__row">
                  <span className="dv-slot">
                    <ItemIcon id={id} />
                    <span className="dv-slot__count">{n}</span>
                  </span>
                  <span className="shop__name">
                    <strong>{item.name}</strong>
                    <span className="dv-caption">{t('shop.have', { count: n })}</span>
                  </span>
                  <span className="shop__price">
                    <Ico name="coin" /> {item.sell}
                  </span>
                  <span className="shop__actions">
                    <button type="button" className="dv-btn" onClick={() => doSell(1)}>
                      {t('shop.sellOne')}
                    </button>
                    {n > 1 && (
                      <button type="button" className="dv-btn" onClick={() => doSell(n)}>
                        {t('shop.sellAll')}
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
        </ul>
      </Panel>
    </div>
  );
}
