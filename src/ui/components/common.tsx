import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
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
  return <div className={`screen-overlay${dim ? ' is-dim' : ''}`}>{children}</div>;
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
