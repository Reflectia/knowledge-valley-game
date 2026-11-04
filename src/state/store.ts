import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';

import { markDone, setScore, unmarkDone } from '@/core/curriculum';
import { deriveProgress, reconcile, type DerivedProgress } from '@/core/rewards';
import { gainXp, todayIso } from '@/core/rules';
import {
  newLabs,
  newWorld,
  parseSaveFile,
  SaveStore,
  toSaveFile,
  type LabsRecord,
  type WorldRecord,
} from '@/core/save';
import type { Curriculum, ISODate, LabKey, RewardEvent } from '@/core/types';

/**
 * Shared game state for Phaser (world) and React (UI). A vanilla Zustand store,
 * so Phaser scenes can read and subscribe without React.
 */
export interface GameState {
  ready: boolean;
  /** True when a saved game was found on start (the menu offers «Продовжити»). */
  hasSave: boolean;
  labs: LabsRecord;
  world: WorldRecord;
  progress: DerivedProgress;
  /** Reward moments waiting for the reward scene (one, or a batch). */
  pendingRewards: RewardEvent[];
  /** Last storage error, shown to the player; lab data stays in memory. */
  saveError: string | null;

  init(): Promise<void>;
  newGame(name: string): Promise<void>;
  markLabDone(key: LabKey, doneDate?: ISODate): Promise<void>;
  unmarkLab(key: LabKey): Promise<void>;
  setLabScore(key: LabKey, score: number | undefined): Promise<void>;
  /** Replace the curriculum (plan import); rewards are reconciled, never duplicated. */
  setCurriculum(curriculum: Curriculum): Promise<void>;
  addXp(amount: number): void;
  /** End the day: next day, full energy, nightly world save. */
  sleep(): Promise<void>;
  exportSave(): string;
  importSave(text: string): Promise<void>;
  takeRewards(): RewardEvent[];
}

export function createGameStore(saves: SaveStore, now: () => Date = () => new Date()): StoreApi<GameState> {
  const fresh = () => {
    const labs = newLabs(now());
    return { labs, world: { state: newWorld(), ledger: {} }, progress: deriveProgress(labs.curriculum, labs.settings.rarityThresholds) };
  };

  return createStore<GameState>()((set, get) => {
    /** Apply new lab data: reconcile rewards, derive progress, queue events, save labs now. */
    const applyLabs = async (labs: LabsRecord) => {
      const { world } = get();
      const r = reconcile(labs.curriculum, world.ledger, world.state, labs.settings.rarityThresholds);
      set((s) => ({
        labs,
        world: { state: r.world, ledger: r.ledger },
        progress: deriveProgress(labs.curriculum, labs.settings.rarityThresholds),
        pendingRewards: [...s.pendingRewards, ...r.events],
      }));
      await persist(() => saves.saveLabs(labs));
    };

    const persist = async (op: () => Promise<void>) => {
      try {
        await op();
        if (get().saveError) set({ saveError: null });
      } catch (e) {
        set({ saveError: e instanceof Error ? e.message : String(e) });
      }
    };

    const editCurriculum = (fn: (c: Curriculum) => Curriculum) => {
      const { labs } = get();
      return applyLabs({ ...labs, curriculum: fn(labs.curriculum) });
    };

    return {
      ready: false,
      hasSave: false,
      ...fresh(),
      pendingRewards: [],
      saveError: null,

      async init() {
        const file = await saves.load();
        if (!file) {
          set({ ready: true, hasSave: false });
          return;
        }
        // The world comes from the last night; pay what labs earned since then.
        set({ labs: file.labs, world: file.world, hasSave: true });
        await applyLabs(file.labs);
        set({ ready: true });
      },

      async newGame(name) {
        const f = fresh();
        f.world.state.player.name = name;
        set({ ...f, pendingRewards: [], hasSave: true });
        await persist(() => saves.replace(toSaveFile(f.labs, f.world, now())));
      },

      markLabDone: (key, doneDate = todayIso(now())) => editCurriculum((c) => markDone(c, key, doneDate)),
      unmarkLab: (key) => editCurriculum((c) => unmarkDone(c, key)),
      setLabScore: (key, score) => editCurriculum((c) => setScore(c, key, score)),
      setCurriculum: (curriculum) => editCurriculum(() => curriculum),

      addXp(amount) {
        const { world, progress } = get();
        set({ world: { ...world, state: { ...world.state, player: gainXp(world.state.player, amount, progress.ceiling) } } });
      },

      async sleep() {
        const { world } = get();
        const state = {
          ...world.state,
          day: world.state.day + 1,
          player: { ...world.state.player, energy: newWorld().player.energy },
        };
        const next = { ...world, state };
        set({ world: next });
        await persist(() => saves.saveWorld(next));
      },

      exportSave() {
        const { labs, world } = get();
        const at = now();
        const withExport = { ...labs, settings: { ...labs.settings, lastExportAt: at.toISOString() } };
        set({ labs: withExport });
        void persist(() => saves.saveLabs(withExport));
        return JSON.stringify(toSaveFile(withExport, world, at), null, 2);
      },

      async importSave(text) {
        const file = parseSaveFile(text); // throws SaveError with a readable message
        set({
          labs: file.labs,
          world: file.world,
          progress: deriveProgress(file.labs.curriculum, file.labs.settings.rarityThresholds),
          pendingRewards: [],
          hasSave: true,
        });
        await persist(() => saves.replace(file));
      },

      takeRewards() {
        const events = get().pendingRewards;
        set({ pendingRewards: [] });
        return events;
      },
    };
  });
}

let instance: StoreApi<GameState> | null = null;

/** The app-wide store, backed by IndexedDB. Created lazily so tests never touch it. */
export async function getGameStore(): Promise<StoreApi<GameState>> {
  if (!instance) {
    const { idbStore } = await import('@/core/idbStore');
    instance = createGameStore(new SaveStore(idbStore()));
  }
  return instance;
}

export function useGameStore<T>(store: StoreApi<GameState>, selector: (state: GameState) => T): T {
  return useStore(store, selector);
}
