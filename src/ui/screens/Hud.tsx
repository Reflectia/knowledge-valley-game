import { useTranslation } from 'react-i18next';

import { DEFAULT_TITLE, packByBranch } from '@/core/content';
import { atCeiling, xpToNext } from '@/core/rules';
import { clockText } from '@/core/time';
import { ITEMS, isConsumable } from '@/core/items';

import { Ico } from '../components/common';
import { ItemIcon } from '../components/ItemIcon';
import { useGame } from '../GameContext';

export function phaseOf(minutes: number): 'morning' | 'day' | 'evening' | 'night' {
  const h = minutes / 60;
  if (h >= 6 && h < 10) return 'morning';
  if (h >= 10 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

/** HH:MM in 10-minute steps, like a game clock (smooth time would flicker). */
const clock = (m: number) => clockText(Math.floor(m / 10) * 10);

/** Game HUD (spec §8 screen 3): time of day, energy, health, coins, toolbar, level and ceiling. */
export function Hud({
  onJournal,
  onMenu,
  onInventory,
  onMail,
  onSkills,
}: {
  onJournal: () => void;
  onMenu: () => void;
  onInventory: () => void;
  onMail: () => void;
  onSkills: () => void;
}) {
  const { t } = useTranslation();
  const player = useGame((s) => s.world.state.player);
  const day = useGame((s) => s.world.state.day);
  const minutes = useGame((s) => s.clockMinutes);
  const progress = useGame((s) => s.progress);
  const selected = useGame((s) => s.selectedSlot);
  const selectSlot = useGame((s) => s.selectSlot);
  const toolbar = useGame((s) => s.world.state.toolbar);
  const unread = useGame((s) => (s.labs.mail ?? []).filter((l) => !l.read).length);
  const maxEnergy = useGame((s) => s.maxEnergy());
  const maxHealth = useGame((s) => s.maxHealth());
  const inventory = useGame((s) => s.world.state.inventory);

  const capped = atCeiling(player, progress.ceiling);
  const need = xpToNext(player.level);
  const xpPct = capped ? 100 : Math.round((player.xp / need) * 100);
  const energyPct = Math.round((player.energy / maxEnergy) * 100);
  const healthPct = Math.round((player.health / maxHealth) * 100);
  const title = (progress.topBranch && packByBranch(progress.topBranch)?.title) || DEFAULT_TITLE;

  // Level pips: a short window around the current level, the ceiling plate before the first locked one.
  const first = Math.max(1, player.level - 2);
  const last = Math.min(progress.ceiling + 1, first + 5);
  const pips = [];
  for (let lv = first; lv <= last; lv++) {
    if (lv === progress.ceiling + 1) {
      pips.push(
        <span key="ceiling" className="dv-levels__ceiling">
          <Ico name="lock" />
          {t('hud.ceiling', { ceiling: progress.ceiling })}
        </span>,
      );
    }
    pips.push(
      <span
        key={lv}
        className={`dv-levels__pip${lv <= player.level ? ' is-reached' : ''}${lv > progress.ceiling ? ' is-locked' : ''}`}
      />,
    );
  }

  return (
    <div className="hud">
      <section className="dv-panel hud__status" aria-label={player.name}>
        <span className="dv-nameplate hud__name">{player.name}</span>
        <p className="hud__title">{title.uk}</p>
        <p className="hud__line">
          <span className="hud__time">
            <Ico name="clock" />
            {t('hud.day', { day })} · {clock(minutes)} · {t(`hud.phase.${phaseOf(minutes)}`)}
          </span>
          <span className="hud__coins" aria-label={t('hud.coins')} title={t('hud.coins')}>
            <Ico name="coin" />
            {player.coins}
          </span>
        </p>
        <div className="dv-bar dv-bar--energy" title={t('hud.energy')}>
          <Ico name="energy" />
          <span className="dv-bar__track">
            <span className="dv-bar__fill" style={{ '--value': `${energyPct}%` } as React.CSSProperties} />
          </span>
          <span className="dv-bar__value">
            {player.energy}/{maxEnergy}
          </span>
        </div>
        <div className="dv-bar dv-bar--health" title={t('hud.health')}>
          <Ico name="heart" />
          <span className="dv-bar__track">
            <span className="dv-bar__fill" style={{ '--value': `${healthPct}%` } as React.CSSProperties} />
          </span>
          <span className="dv-bar__value">
            {player.health}/{maxHealth}
          </span>
        </div>
        <div className={`dv-bar dv-bar--xp${capped ? ' is-capped' : ''}`} title={capped ? t('hud.ceilingHint') : t('hud.xp')}>
          <Ico name={capped ? 'lock' : 'xp'} />
          <span className="dv-bar__track">
            <span className="dv-bar__fill" style={{ '--value': `${xpPct}%` } as React.CSSProperties} />
          </span>
          <span className="dv-bar__value">{capped ? t('hud.ceiling', { ceiling: progress.ceiling }) : `${player.xp}/${need}`}</span>
        </div>
        <div className="hud__levels">
          <span className="hud__level">{t('hud.level', { level: player.level })}</span>
          <span className="dv-levels">{pips}</span>
        </div>
        {capped && <p className="dv-caption hud__hint">{t('hud.ceilingHint')}</p>}
      </section>

      <div className="hud__buttons">
        <button
          type="button"
          className="dv-btn dv-btn--icon hud__mail"
          aria-label={unread ? t('hud.mailUnread', { count: unread }) : t('hud.mail')}
          data-tip={unread ? t('hud.mailUnread', { count: unread }) : t('hud.mail')}
          onClick={onMail}
        >
          <Ico name="mail" />
          {unread > 0 && <span className="hud__badge">{unread}</span>}
        </button>
        <button type="button" className="dv-btn dv-btn--icon" aria-label={t('hud.skills')} data-tip={t('hud.skills')} onClick={onSkills}>
          <Ico name="xp" />
        </button>
        <button type="button" className="dv-btn dv-btn--icon" aria-label={t('hud.inventory')} title={t('hud.inventory')} onClick={onInventory}>
          <Ico name="spark" />
        </button>
        <button type="button" className="dv-btn dv-btn--icon" aria-label={t('hud.journal')} title={t('hud.journal')} onClick={onJournal}>
          <Ico name="book" />
        </button>
        <button type="button" className="dv-btn dv-btn--icon" aria-label={t('hud.menu')} title={t('hud.menu')} onClick={onMenu}>
          <Ico name="gear" />
        </button>
      </div>

      <nav className="hud__toolbar dv-panel" aria-label={t('hud.toolbar')}>
        {toolbar.map((id, i) => {
          const item = id ? ITEMS[id] : undefined;
          const n = id ? (inventory[id] ?? 0) : 0;
          return (
            <button
              key={i}
              type="button"
              className={`dv-slot hud__slot${selected === i ? ' is-selected' : ''}`}
              aria-label={item ? `${item.name} (${i + 1})` : t('hud.emptySlot', { n: i + 1 })}
              data-tip={item?.name}
              aria-pressed={selected === i}
              onClick={() => selectSlot(i)}
            >
              {item && <ItemIcon id={id!} />}
              {item && isConsumable(id!) && <span className="dv-slot__count">{n}</span>}
              <span className="hud__key">{i + 1}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
