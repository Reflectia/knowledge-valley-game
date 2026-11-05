import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import type { Rarity } from '@/core/types';

import { Ico } from './common';

interface Tip {
  /** `pointer`: follows the cursor; `focus`: anchored under (or above) the focused element. */
  source: 'pointer' | 'focus';
  /** Screen px (as in clientX / getBoundingClientRect). */
  x: number;
  y: number;
  /** Focus tips: the element's right edge, to right-align the tip near the screen edge. */
  right?: number;
  /** For focus tips near the bottom edge: the element's top, so the tip goes above it. */
  above?: number;
  name: string;
  rarity?: Rarity;
  text?: string;
}

function tipData(el: HTMLElement): Pick<Tip, 'name' | 'rarity' | 'text'> {
  return { name: el.dataset.tip!, rarity: el.dataset.tipRarity as Rarity | undefined, text: el.dataset.tipText };
}

/**
 * Tooltip (design system: Tooltip). Any element with `data-tip="Name"` gets one;
 * `data-tip-rarity` adds the rarity word and badge, `data-tip-text` a short line under the name.
 * It follows the mouse, and also shows for keyboard focus (WCAG 1.4.13, 2.1.1) next to the
 * focused element; Esc hides it without moving focus.
 */
export function HoverTip() {
  const { t } = useTranslation();
  const [tip, setTip] = useState<Tip | null>(null);
  const shown = useRef<Tip | null>(null);
  shown.current = tip;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip]');
      if (!el) {
        // Moving the mouse elsewhere does not take away a tip shown for keyboard focus.
        setTip((cur) => (cur?.source === 'focus' ? cur : null));
        return;
      }
      setTip({ source: 'pointer', x: e.clientX, y: e.clientY, ...tipData(el) });
    };
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const el = target.closest<HTMLElement>('[data-tip]');
      // Only keyboard focus (a mouse click already has the pointer tip).
      if (!el || !target.matches(':focus-visible')) {
        setTip((cur) => (cur?.source === 'focus' ? null : cur));
        return;
      }
      const r = el.getBoundingClientRect();
      const nearBottom = r.bottom + 120 * zoomOf() > window.innerHeight;
      setTip({ source: 'focus', x: r.left, right: r.right, y: r.bottom, above: nearBottom ? r.top : undefined, ...tipData(el) });
    };
    const onFocusOut = () => setTip((cur) => (cur?.source === 'focus' ? null : cur));
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || shown.current?.source !== 'focus') return;
      // First Esc only closes the tip; the next one does the usual (close window / open menu).
      e.preventDefault();
      e.stopImmediatePropagation();
      setTip(null);
    };
    const hide = () => setTip(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', hide);
    window.addEventListener('blur', hide);
    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', hide);
      window.removeEventListener('blur', hide);
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);

  if (!tip) return null;
  // The UI root is zoomed (×3, ×4): convert screen px to its CSS px.
  const zoom = zoomOf();
  let style: CSSProperties;
  if (tip.source === 'pointer') {
    const x = tip.x / zoom + 12;
    const y = tip.y / zoom + 12;
    const flip = tip.x + 360 * zoom > window.innerWidth;
    style = flip ? { right: window.innerWidth / zoom - x + 32, top: y } : { left: x, top: y };
  } else {
    // Clear of the 6 px focus ring.
    const gap = 10;
    const flip = tip.x + 360 * zoom > window.innerWidth;
    const horizontal = flip ? { right: (window.innerWidth - (tip.right ?? tip.x)) / zoom } : { left: tip.x / zoom };
    style =
      tip.above !== undefined
        ? { ...horizontal, bottom: (window.innerHeight - tip.above) / zoom + gap }
        : { ...horizontal, top: tip.y / zoom + gap };
  }
  return (
    <div className="dv-tooltip hover-tip" role="tooltip" style={style}>
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

function zoomOf(): number {
  const root = document.querySelector<HTMLElement>('.app-ui');
  return root ? parseFloat(getComputedStyle(root).zoom || '1') || 1 : 1;
}
