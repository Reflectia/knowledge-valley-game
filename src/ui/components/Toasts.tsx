import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

import { Ico } from './common';

export interface Toast {
  id: number;
  icon: string;
  title: string;
  text?: string;
  onClick?: () => void;
  /** How long a plain notice stays, in ms (paused while hovered or focused). Notices with an action stay until used or closed. */
  ms: number;
}

const toasts = createStore<{ list: Toast[] }>(() => ({ list: [] }));
let nextId = 1;

function dismiss(id: number): void {
  toasts.setState((s) => ({ list: s.list.filter((x) => x.id !== id) }));
}

/** At most this many notices with an action wait on screen; the oldest goes first. */
const MAX_ACTION_TOASTS = 3;

/** Show a short non-blocking notice in the top-right corner (Toast README: 4 s). */
export function showToast(t: Omit<Toast, 'id' | 'ms'>, ms = 4000): void {
  const id = nextId++;
  toasts.setState((s) => {
    let list = [...s.list, { ...t, id, ms }];
    const actions = list.filter((x) => x.onClick);
    if (actions.length > MAX_ACTION_TOASTS) {
      const drop = new Set(actions.slice(0, actions.length - MAX_ACTION_TOASTS).map((x) => x.id));
      list = list.filter((x) => !drop.has(x.id));
    }
    return { list };
  });
}

export function Toasts() {
  const list = useStore(toasts, (s) => s.list);
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

/**
 * One notice. A plain one waits while the pointer is over it or it has keyboard focus; one with
 * an action has no time limit at all (WCAG 2.2.1) — it stays until its button or × is used,
 * so it can be reached with Tab at any pace (WCAG 2.1.1).
 */
function ToastItem({ toast }: { toast: Toast }) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const left = useRef(toast.ms);
  const paused = hovered || focused || !!toast.onClick;

  useEffect(() => {
    if (paused) return;
    const started = performance.now();
    const timer = window.setTimeout(() => dismiss(toast.id), left.current);
    return () => {
      window.clearTimeout(timer);
      left.current = Math.max(1000, left.current - (performance.now() - started));
    };
  }, [paused, toast.id]);

  const body = (
    <>
      <Ico name={toast.icon} lg />
      <span>
        <span className="dv-toast__title">{toast.title}</span>
        {toast.text}
      </span>
    </>
  );
  const handlers = {
    onPointerEnter: () => setHovered(true),
    onPointerLeave: () => setHovered(false),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };
  if (!toast.onClick) {
    return (
      <div className="dv-toast" {...handlers}>
        {body}
      </div>
    );
  }
  return (
    <div className="dv-toast is-clickable" {...handlers}>
      <button
        type="button"
        className="dv-toast__action"
        onClick={() => {
          dismiss(toast.id);
          toast.onClick!();
        }}
      >
        {body}
      </button>
      <button type="button" className="dv-btn dv-btn--icon dv-toast__close" aria-label={t('common.close')} onClick={() => dismiss(toast.id)}>
        <Ico name="close" />
      </button>
    </div>
  );
}
