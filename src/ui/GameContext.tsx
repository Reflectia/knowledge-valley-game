import { createContext, useContext, type ReactNode } from 'react';
import type { StoreApi } from 'zustand/vanilla';

import { useGameStore, type GameState } from '@/state/store';

const Ctx = createContext<StoreApi<GameState> | null>(null);

export function GameProvider({ store, children }: { store: StoreApi<GameState>; children: ReactNode }) {
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useGameApi(): StoreApi<GameState> {
  const store = useContext(Ctx);
  if (!store) throw new Error('GameProvider is missing');
  return store;
}

export function useGame<T>(selector: (s: GameState) => T): T {
  return useGameStore(useGameApi(), selector);
}
