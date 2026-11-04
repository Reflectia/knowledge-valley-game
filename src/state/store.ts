import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

/**
 * Shared state between Phaser (world) and React (UI).
 * A vanilla store so Phaser scenes can read/subscribe without React.
 * Stage 0 holds only a placeholder; the real game state arrives in stage 2.
 */
export interface GameState {
  uiScale: 'auto' | 2 | 3 | 4;
  debugClicks: number;
  incrementDebugClicks: () => void;
}

export const gameStore = createStore<GameState>()((set) => ({
  uiScale: 'auto',
  debugClicks: 0,
  incrementDebugClicks: () => set((s) => ({ debugClicks: s.debugClicks + 1 })),
}));

export function useGameStore<T>(selector: (state: GameState) => T): T {
  return useStore(gameStore, selector);
}
