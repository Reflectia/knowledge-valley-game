import { useEffect, useRef, useState } from 'react';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

import { Ico } from './common';

export interface Toast {
  id: number;
  icon: string;
  title: string;
  text?: string;
  onClick?: () => void;
  /** How long it stays, in ms (paused while hovered or focused). */
  ms: number;
}

const toasts = createStore<{ list: Toast[] }>(() => ({ list: [] }));
let nextId = 1;

function dismiss(id: number): void {
  toasts.setState((s) => ({ list: s.list.filter((x) => x.id !== id) }));
}

/** Show a short non-blocking notice in the top-right corner (Toast README: 4 s). */
export function showToast(t: Omit<Toast, 'id' | 'ms'>, ms = 4000): void {
  const id = nextId++;
  toasts.setState((s) => ({ list: [...s.list, { ...t, id, ms }] }));
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
 * One notice. It waits while the pointer is over it or it has keyboard focus
 * (WCAG 2.2.1); a notice with an action is a real button (WCAG 2.1.1).
 */
function ToastItem({ toast }: { toast: Toast }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const left = useRef(toast.ms);
  const paused = hovered || focused;

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
    <button
      type="button"
      className="dv-toast is-clickable"
      {...handlers}
      onClick={() => {
        dismiss(toast.id);
        toast.onClick!();
      }}
    >
      {body}
    </button>
  );
}
