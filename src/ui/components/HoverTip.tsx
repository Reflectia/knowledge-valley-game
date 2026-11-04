import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Rarity } from '@/core/types';

import { Ico } from './common';

/**
 * Tooltip next to the cursor (design system: Tooltip). Any element with
 * `data-tip="Name"` gets one; `data-tip-rarity` adds the rarity word and badge,
 * `data-tip-text` a short line under the name.
 */
export function HoverTip() {
  const { t } = useTranslation();
  const [tip, setTip] = useState<{ x: number; y: number; name: string; rarity?: Rarity; text?: string } | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip]');
      if (!el) {
        setTip(null);
        return;
      }
      setTip({
        x: e.clientX,
        y: e.clientY,
        name: el.dataset.tip!,
        rarity: el.dataset.tipRarity as Rarity | undefined,
        text: el.dataset.tipText,
      });
    };
    const hide = () => setTip(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', hide);
    window.addEventListener('blur', hide);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', hide);
      window.removeEventListener('blur', hide);
    };
  }, []);

  if (!tip) return null;
  // The UI root is zoomed (×3, ×4): convert screen px to its CSS px.
  const root = document.querySelector<HTMLElement>('.app-ui');
  const zoom = root ? parseFloat(getComputedStyle(root).zoom || '1') || 1 : 1;
  const x = tip.x / zoom + 16;
  const y = tip.y / zoom + 16;
  const flip = tip.x + 360 * zoom > window.innerWidth;
  return (
    <div
      className="dv-tooltip hover-tip"
      role="tooltip"
      style={flip ? { right: window.innerWidth / zoom - x + 32, top: y } : { left: x, top: y }}
    >
      <p className="dv-tooltip__title">{tip.name}</p>
      {tip.rarity && (
        <p className={`dv-tooltip__meta dv-rarity--${tip.rarity}`}>
          <Ico name={`r-${tip.rarity}`} /> {t(`rarity.${tip.rarity}`)}
        </p>
      )}
      {tip.text && <p className="dv-tooltip__text">{tip.text}</p>}
    </div>
  );
}
