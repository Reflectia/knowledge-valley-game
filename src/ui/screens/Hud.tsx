import { useTranslation } from 'react-i18next';

import { BALANCE, DEFAULT_TITLE, packByBranch } from '@/core/content';
import { atCeiling, xpToNext } from '@/core/rules';
import { clockText } from '@/core/time';
import { TEMP_FRAMES } from '@/game/assets/manifest';

import { Ico, SheetIcon, assetUrl } from '../components/common';
import { useGame } from '../GameContext';

/** Toolbar contents until the inventory arrives (stage 6). Tools are temporary art. */
const TOOLBAR: ({ id: string; sheet: string; frame: number } | { id: string; img: string } | null)[] = [
  { id: 'hoe', sheet: 'temp-farm', frame: TEMP_FRAMES.hoe },
  { id: 'wateringCan', sheet: 'temp-farm', frame: TEMP_FRAMES.wateringCan },
  { id: 'axe', sheet: 'temp-farm', frame: TEMP_FRAMES.axe },
  { id: 'pickaxe', sheet: 'temp-town', frame: TEMP_FRAMES.pickaxe },
  { id: 'sword', sheet: 'temp-dungeon', frame: TEMP_FRAMES.sword },
  { id: 'seed', img: 'item-seed' },
  null,
  null,
  null,
];

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
export function Hud({ onJournal, onMenu }: { onJournal: () => void; onMenu: () => void }) {
  const { t } = useTranslation();
  const player = useGame((s) => s.world.state.player);
  const day = useGame((s) => s.world.state.day);
  const minutes = useGame((s) => s.clockMinutes);
  const progress = useGame((s) => s.progress);
  const selected = useGame((s) => s.selectedSlot);
  const selectSlot = useGame((s) => s.selectSlot);

  const capped = atCeiling(player, progress.ceiling);
  const need = xpToNext(player.level);
  const xpPct = capped ? 100 : Math.round((player.xp / need) * 100);
  const energyPct = Math.round((player.energy / BALANCE.player.maxEnergy) * 100);
  const healthPct = Math.round((player.health / BALANCE.player.maxHealth) * 100);
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
            {player.energy}/{BALANCE.player.maxEnergy}
          </span>
        </div>
        <div className="dv-bar dv-bar--health" title={t('hud.health')}>
          <Ico name="heart" />
          <span className="dv-bar__track">
            <span className="dv-bar__fill" style={{ '--value': `${healthPct}%` } as React.CSSProperties} />
          </span>
          <span className="dv-bar__value">
            {player.health}/{BALANCE.player.maxHealth}
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
        <button type="button" className="dv-btn dv-btn--icon" aria-label={t('hud.mail')} title={t('hud.mail')} disabled>
          <Ico name="mail" />
        </button>
        <button type="button" className="dv-btn dv-btn--icon" aria-label={t('hud.journal')} title={t('hud.journal')} onClick={onJournal}>
          <Ico name="book" />
        </button>
        <button type="button" className="dv-btn dv-btn--icon" aria-label={t('hud.menu')} title={t('hud.menu')} onClick={onMenu}>
          <Ico name="gear" />
        </button>
      </div>

      <nav className="hud__toolbar dv-panel" aria-label={t('hud.toolbar')}>
        {TOOLBAR.map((tool, i) => (
          <button
            key={i}
            type="button"
            className={`dv-slot hud__slot${selected === i ? ' is-selected' : ''}`}
            title={tool ? `${t(`hud.tools.${tool.id}`)} (${i + 1})` : String(i + 1)}
            aria-pressed={selected === i}
            onClick={() => selectSlot(i)}
          >
            {tool && 'sheet' in tool && <SheetIcon sheet={tool.sheet} frame={tool.frame} label={t(`hud.tools.${tool.id}`)} />}
            {tool && 'img' in tool && <img src={assetUrl(tool.img)} alt={t(`hud.tools.${tool.id}`)} />}
            <span className="hud__key">{i + 1}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
