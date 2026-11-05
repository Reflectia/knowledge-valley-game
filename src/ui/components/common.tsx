import { useEffect, useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { ASSETS } from '@/game/assets/manifest';

/** Design-system 8×8 icon shown ×2 (`dv-ico--*`). */
export function Ico({ name, lg = false }: { name: string; lg?: boolean }) {
  return <span className={`dv-ico dv-ico--${name}${lg ? ' dv-ico--lg' : ''}`} aria-hidden />;
}

/** URL of a texture from the asset manifest (same files the world uses). */
export function assetUrl(key: string): string {
  const a = ASSETS[key];
  if (!a) throw new Error(`Unknown asset ${key}`);
  return a.url;
}

/** One 16×16 frame of a sprite sheet, drawn at `scale` without smoothing. */
export function SheetIcon({
  sheet,
  frame,
  columns = 12,
  size = 16,
  spacing = 0,
  scale = 2,
  label,
}: {
  sheet: string;
  frame: number;
  columns?: number;
  size?: number;
  spacing?: number;
  scale?: number;
  label?: string;
}) {
  const col = frame % columns;
  const row = Math.floor(frame / columns);
  const step = size + spacing;
  const style: CSSProperties = {
    width: size * scale,
    height: size * scale,
    backgroundImage: `url(${assetUrl(sheet)})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: `${-col * step * scale}px ${-row * step * scale}px`,
    backgroundSize: `${columns * step * scale}px auto`,
    imageRendering: 'pixelated',
  };
  return <span className="sheet-icon" style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={!label} />;
}

/** Panel with a title and the close icon-button on its corner (Panel README). */
export function Panel({
  title,
  onClose,
  className = '',
  children,
  labelledBy,
}: {
  title: ReactNode;
  onClose?: () => void;
  className?: string;
  children: ReactNode;
  labelledBy: string;
}) {
  const { t } = useTranslation();
  return (
    <section className={`dv-panel ${className}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <h2 className="dv-panel__title" id={labelledBy}>
        {title}
      </h2>
      {onClose && (
        <button type="button" className="dv-btn dv-btn--icon dv-panel__close" aria-label={t('common.close')} onClick={onClose}>
          <Ico name="close" />
        </button>
      )}
      {children}
    </section>
  );
}

/** Centered modal layer over the world. */
export function Overlay({ children, dim = false }: { children: ReactNode; dim?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref);
  return (
    <div ref={ref} className={`screen-overlay${dim ? ' is-dim' : ''}`}>
      {children}
    </div>
  );
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);
}

// Open modal layers, innermost last. Only the top one is interactive.
const modalStack: HTMLElement[] = [];
const madeInert = new Set<HTMLElement>();
const lastFocus = new WeakMap<HTMLElement, HTMLElement>();

/** Make everything outside the top modal layer inert (not focusable, not clickable). */
function applyInert(): void {
  for (const el of madeInert) el.inert = false;
  madeInert.clear();
  const top = modalStack[modalStack.length - 1];
  const root = top?.closest('.app-ui');
  if (!top || !root) return;
  for (let node: HTMLElement = top; node !== root && node.parentElement; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || !(sibling instanceof HTMLElement) || sibling.inert) continue;
      sibling.inert = true;
      madeInert.add(sibling);
    }
  }
}

/**
 * Modal focus (WCAG 2.4.3): move focus into the layer when it opens, keep Tab inside it,
 * make the rest of the UI inert, and give focus back to where it was when the layer closes.
 */
export function useModalFocus(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const layer = ref.current;
    if (!layer) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalStack.push(layer);
    applyInert();

    // autoFocus (a dialog's main button) has already run; otherwise focus the dialog itself,
    // so a screen reader announces its title and the next Tab lands on its first control.
    const resumed = lastFocus.get(layer);
    if (resumed && layer.contains(resumed)) {
      resumed.focus({ preventScroll: true });
    } else if (!layer.contains(document.activeElement)) {
      const dialog = layer.matches('[role="dialog"]') ? layer : layer.querySelector<HTMLElement>('[role="dialog"]');
      const target = dialog ?? focusables(layer)[0];
      if (target) {
        if (!target.hasAttribute('tabindex') && !target.matches(FOCUSABLE)) target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.defaultPrevented || modalStack[modalStack.length - 1] !== layer) return;
      const list = focusables(layer);
      if (list.length === 0) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      const outside = !layer.contains(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      // StrictMode re-runs the effect on the same layer: resume where focus was.
      if (document.activeElement instanceof HTMLElement && layer.contains(document.activeElement)) {
        lastFocus.set(layer, document.activeElement);
      }
      const i = modalStack.indexOf(layer);
      if (i >= 0) modalStack.splice(i, 1);
      applyInert();
      // Back to the control that opened the layer (if it is still there and usable).
      if (previous && previous.isConnected && !previous.closest('[inert]') && !layer.contains(previous)) {
        previous.focus({ preventScroll: true });
      } else {
        // The opener is gone (e.g. the window re-rendered): stay in the window that is still open.
        const top = modalStack[modalStack.length - 1];
        if (top && !top.contains(document.activeElement)) {
          const dialog = top.matches('[role="dialog"]') ? top : top.querySelector<HTMLElement>('[role="dialog"]');
          const target = dialog ?? focusables(top)[0];
          if (target) {
            if (!target.hasAttribute('tabindex') && !target.matches(FOCUSABLE)) target.tabIndex = -1;
            target.focus({ preventScroll: true });
          }
        }
      }
    };
  }, [ref]);
}

/** Hidden file input behind a regular button. */
export function FileButton({
  label,
  accept,
  onFile,
  primary = false,
  className,
}: {
  label: ReactNode;
  accept: string;
  onFile: (file: File) => void;
  primary?: boolean;
  /** Replaces the default `dv-btn` look. */
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className ?? `dv-btn${primary ? ' dv-btn--primary' : ''}`} onClick={() => input.current?.click()}>
        {label}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
    </>
  );
}

/** Run `fn` on Escape while mounted (for nested dialogs that close first). */
export function useEscape(fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        ref.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
}

/**
 * ARIA tabs (WAI-ARIA Authoring Practices): only the selected tab is in the Tab order;
 * ←/→ move to the previous/next tab and select it, Home/End go to the first/last.
 * Put `tabPanelProps` on the element that shows the selected tab's content.
 */
export function tabProps(idBase: string, index: number, selected: number, count: number, select: (i: number) => void) {
  return {
    role: 'tab' as const,
    id: `${idBase}-tab-${index}`,
    'aria-selected': index === selected,
    'aria-controls': `${idBase}-panel`,
    tabIndex: index === selected ? 0 : -1,
    onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => {
      const next =
        e.key === 'ArrowRight' ? (index + 1) % count
        : e.key === 'ArrowLeft' ? (index - 1 + count) % count
        : e.key === 'Home' ? 0
        : e.key === 'End' ? count - 1
        : -1;
      if (next < 0) return;
      e.preventDefault();
      select(next);
      (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
    },
  };
}

export function tabPanelProps(idBase: string, selected: number) {
  return { role: 'tabpanel' as const, id: `${idBase}-panel`, 'aria-labelledby': `${idBase}-tab-${selected}` };
}
