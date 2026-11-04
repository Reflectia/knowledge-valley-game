import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';

import { markDone, setScore, unmarkDone } from '@/core/curriculum';
import { deriveProgress, pruneShown, reconcile, rewardKey, type DerivedProgress } from '@/core/rewards';
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
import type { Curriculum, ISODate, LabKey, PlayerState, RewardEvent, Settings } from '@/core/types';

/** Minutes since midnight when a game day starts (morning). */
export const DAY_START_MINUTES = 6 * 60;

/**
 * Shared game state for Phaser (world) and React (UI). A vanilla Zustand store,
 * so Phaser scenes can read and subscribe without React.
 */
export interface GameState {
  ready: boolean;
  /** True when a saved game exists (the menu offers «Продовжити»). */
  hasSave: boolean;
  labs: LabsRecord;
  world: WorldRecord;
  progress: DerivedProgress;
  /** Reward moments waiting for the reward scene (one, or a batch). */
  pendingRewards: RewardEvent[];
  /** Last storage error, shown to the player; lab data stays in memory. */
  saveError: string | null;

  // Session-only state (not saved).
  /** Time of day in minutes since midnight; the day/night cycle drives it (stage 5). */
  clockMinutes: number;
  /** Selected toolbar slot 0..8 (keys 1–9, mouse wheel). */
  selectedSlot: number;
  /** A menu or window is open: the world ignores keyboard and mouse. */
  uiBlocking: boolean;

  init(): Promise<void>;
  newGame(name: string, appearance: PlayerState['appearance']): Promise<void>;
  markLabDone(key: LabKey, doneDate?: ISODate): Promise<void>;
  unmarkLab(key: LabKey): Promise<void>;
  setLabScore(key: LabKey, score: number | undefined): Promise<void>;
  /** Replace the curriculum (plan import); rewards are reconciled, never duplicated. */
  setCurriculum(curriculum: Curriculum): Promise<void>;
  /** Change settings; saved immediately. New rarity thresholds re-grade items silently. */
  updateSettings(patch: Partial<Omit<Settings, 'createdAt'>>): Promise<void>;
  addXp(amount: number): void;
  /** End the day: next day, full energy, nightly world save. */
  sleep(): Promise<void>;
  exportSave(): string;
  importSave(text: string): Promise<void>;
  takeRewards(): RewardEvent[];
  selectSlot(slot: number): void;
  setUiBlocking(on: boolean): void;
}

export function createGameStore(saves: SaveStore, now: () => Date = () => new Date()): StoreApi<GameState> {
  const fresh = () => {
    const labs = newLabs(now());
    return {
      labs,
      world: { state: newWorld(), ledger: {} },
      progress: deriveProgress(labs.curriculum, labs.settings.rarityThresholds),
    };
  };

  return createStore<GameState>()((set, get) => {
    const persist = async (op: () => Promise<void>) => {
      try {
        await op();
        if (get().saveError) set({ saveError: null });
      } catch (e) {
        set({ saveError: e instanceof Error ? e.message : String(e) });
      }
    };

    /**
     * Apply new lab data: reconcile rewards, derive progress, queue reward events
     * (unless silent), and save the labs record immediately.
     */
    const applyLabs = async (incoming: LabsRecord, silent = false) => {
      const { world } = get();
      const thresholds = incoming.settings.rarityThresholds;
      const r = reconcile(incoming.curriculum, world.ledger, world.state, thresholds);
      const shown = pruneShown(incoming.shownRewards ?? [], incoming.curriculum, thresholds);
      const seen = new Set(shown);
      const fresh = silent ? [] : r.events.filter((e) => !seen.has(rewardKey(e)));
      // Silent changes (new thresholds) count as seen, so they never pop up later.
      const labs = { ...incoming, shownRewards: silent ? [...new Set([...shown, ...r.events.map(rewardKey)])] : shown };
      set((s) => ({
        labs,
        world: { state: r.world, ledger: r.ledger },
        progress: deriveProgress(labs.curriculum, thresholds),
        pendingRewards: [...s.pendingRewards.filter((e) => !fresh.some((f) => rewardKey(f) === rewardKey(e))), ...fresh],
      }));
      await persist(() => saves.saveLabs(labs));
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
      clockMinutes: DAY_START_MINUTES,
      selectedSlot: 0,
      uiBlocking: true,

      async init() {
        let file;
        try {
          file = await saves.load();
        } catch (e) {
          set({ ready: true, saveError: e instanceof Error ? e.message : String(e) });
          return;
        }
        if (!file) {
          set({ ready: true, hasSave: false });
          return;
        }
        // The world comes from the last night; pay what labs earned since then.
        set({ labs: file.labs, world: file.world, hasSave: true });
        await applyLabs(file.labs);
        set({ ready: true });
      },

      async newGame(name, appearance) {
        const f = fresh();
        f.world.state.player = { ...f.world.state.player, name, appearance };
        set({ ...f, pendingRewards: [], hasSave: true, clockMinutes: DAY_START_MINUTES });
        await persist(() => saves.replace(toSaveFile(f.labs, f.world, now())));
      },

      markLabDone: (key, doneDate = todayIso(now())) => editCurriculum((c) => markDone(c, key, doneDate)),
      unmarkLab: (key) => editCurriculum((c) => unmarkDone(c, key)),
      setLabScore: (key, score) => editCurriculum((c) => setScore(c, key, score)),
      setCurriculum: (curriculum) => editCurriculum(() => curriculum),

      updateSettings(patch) {
        const { labs } = get();
        return applyLabs({ ...labs, settings: { ...labs.settings, ...patch } }, true);
      },

      addXp(amount) {
        const { world, progress } = get();
        set({
          world: { ...world, state: { ...world.state, player: gainXp(world.state.player, amount, progress.ceiling) } },
        });
      },

      async sleep() {
        const { world } = get();
        const state = {
          ...world.state,
          day: world.state.day + 1,
          player: { ...world.state.player, energy: newWorld().player.energy },
        };
        const next = { ...world, state };
        set({ world: next, clockMinutes: DAY_START_MINUTES });
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
          clockMinutes: DAY_START_MINUTES,
        });
        await persist(() => saves.replace(file));
      },

      takeRewards() {
        const { pendingRewards: events, labs } = get();
        const shown = [...new Set([...(labs.shownRewards ?? []), ...events.map(rewardKey)])];
        const next = { ...labs, shownRewards: shown };
        set({ pendingRewards: [], labs: next });
        void persist(() => saves.saveLabs(next));
        return events;
      },

      selectSlot: (slot) => set({ selectedSlot: ((slot % 9) + 9) % 9 }),
      setUiBlocking: (on) => set({ uiBlocking: on }),
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
