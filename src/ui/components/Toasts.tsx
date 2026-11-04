import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

import { Ico } from './common';

export interface Toast {
  id: number;
  icon: string;
  title: string;
  text?: string;
  onClick?: () => void;
}

const toasts = createStore<{ list: Toast[] }>(() => ({ list: [] }));
let nextId = 1;

/** Show a short non-blocking notice in the top-right corner (Toast README: 4 s). */
export function showToast(t: Omit<Toast, 'id'>, ms = 4000): void {
  const id = nextId++;
  toasts.setState((s) => ({ list: [...s.list, { ...t, id }] }));
  window.setTimeout(() => toasts.setState((s) => ({ list: s.list.filter((x) => x.id !== id) })), ms);
}

export function Toasts() {
  const list = useStore(toasts, (s) => s.list);
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <div
          key={t.id}
          className={`dv-toast${t.onClick ? ' is-clickable' : ''}`}
          onClick={t.onClick}
          role={t.onClick ? 'button' : undefined}
        >
          <Ico name={t.icon} lg />
          <span>
            <span className="dv-toast__title">{t.title}</span>
            {t.text}
          </span>
        </div>
      ))}
    </div>
  );
}
