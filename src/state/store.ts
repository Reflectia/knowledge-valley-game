import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';

import { markDone, setScore, unmarkDone } from '@/core/curriculum';
import { deriveProgress, pruneShown, reconcile, rewardKey, type DerivedProgress } from '@/core/rewards';
import { BALANCE } from '@/core/content';
import { growNight } from '@/core/homestead';
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
import { DAY, dayOver, MINUTES_PER_SECOND } from '@/core/time';
import type { Curriculum, ISODate, LabKey, PlayerState, RewardEvent, Settings, WorldState } from '@/core/types';

/** Minutes since midnight when a game day starts (morning). */
export const DAY_START_MINUTES = DAY.startMinutes;

/** Why the day is ending: the bed (asks first), 02:00, or no energy left. */
export type SleepReason = 'bed' | 'late' | 'tired';

/** A window the world asks the UI to open (clicking the journal on the desk, the shop stall). */
export type UiRequest = 'journal' | 'shop';

/** Actions that cost energy and give experience (balance.json `actions`). */
export type ActionKind = keyof typeof BALANCE.actions;

/** Result of a world edit: the new state, or a reason code for a short notice. */
export type EditResult = { ok: true; world: WorldState } | { ok: false; reason: string };

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
  /** A menu or window is open: the world ignores keyboard and mouse, time stands still. */
  uiBlocking: boolean;
  /** Bumped when the world must restart at home in the morning (new session, new day). */
  worldEpoch: number;
  /** Set when the day should end; the UI confirms or explains, then calls sleep(). */
  sleepRequest: SleepReason | null;
  uiRequest: UiRequest | null;

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
  /** Spend energy on an action; at zero the heroine is too tired and goes to sleep. */
  spendEnergy(amount: number): void;
  /**
   * Do a world action that costs energy and gives XP (till, water, chop…). `edit` gets the
   * world state and returns the new one; nothing is spent when it fails. Returns the reason
   * on failure ('tired' when energy is short).
   */
  act(kind: ActionKind, edit: (w: WorldState) => EditResult): string | null;
  /** Free edits (shop, toolbar, decor). */
  editWorld(edit: (w: WorldState) => EditResult | WorldState): string | null;
  /** Advance the clock by real milliseconds (paused while a window is open). */
  tickClock(realMs: number): void;
  requestSleep(reason: SleepReason): void;
  cancelSleep(): void;
  requestUi(kind: UiRequest): void;
  takeUiRequest(): UiRequest | null;
  /** Start playing (continue / new game / imported save): morning at home. */
  beginSession(): void;
  /** End the day: next day, full energy, nightly world save, wake up at home. */
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
      worldEpoch: 0,
      sleepRequest: null,
      uiRequest: null,

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

      spendEnergy(amount) {
        const { world } = get();
        const energy = Math.max(0, world.state.player.energy - Math.max(0, amount));
        set({ world: { ...world, state: { ...world.state, player: { ...world.state.player, energy } } } });
        if (energy === 0 && !get().sleepRequest) set({ sleepRequest: 'tired' });
      },

      act(kind, edit) {
        const { world, progress } = get();
        const cost = BALANCE.actions[kind];
        if (world.state.player.energy < cost.energy) return 'tired';
        const r = edit(world.state);
        if (!r.ok) return r.reason;
        const energy = r.world.player.energy - cost.energy;
        const player = gainXp({ ...r.world.player, energy }, cost.xp, progress.ceiling);
        set({ world: { ...world, state: { ...r.world, player } } });
        if (energy <= 0 && !get().sleepRequest) set({ sleepRequest: 'tired' });
        return null;
      },

      editWorld(edit) {
        const { world } = get();
        const r = edit(world.state);
        if ('ok' in r && r.ok === false) return r.reason;
        const next = 'ok' in r ? (r as { world: WorldState }).world : (r as WorldState);
        set({ world: { ...world, state: next } });
        return null;
      },

      tickClock(realMs) {
        const s = get();
        if (s.uiBlocking || s.sleepRequest) return;
        const clockMinutes = Math.min(DAY.endMinutes, s.clockMinutes + (realMs / 1000) * MINUTES_PER_SECOND);
        set({ clockMinutes });
        if (dayOver(clockMinutes)) set({ sleepRequest: 'late' });
      },

      requestSleep: (reason) => set({ sleepRequest: reason }),
      cancelSleep: () => set({ sleepRequest: null }),
      requestUi: (kind) => set({ uiRequest: kind }),
      takeUiRequest() {
        const r = get().uiRequest;
        if (r) set({ uiRequest: null });
        return r;
      },

      beginSession: () =>
        set((s) => ({ worldEpoch: s.worldEpoch + 1, clockMinutes: DAY_START_MINUTES, sleepRequest: null, uiRequest: null })),

      async sleep() {
        const { world } = get();
        // Night: watered crops grow, the soil dries.
        const grown = growNight(world.state);
        const state = {
          ...grown,
          day: world.state.day + 1,
          player: { ...world.state.player, energy: newWorld().player.energy },
        };
        const next = { ...world, state };
        set((s) => ({ world: next, clockMinutes: DAY_START_MINUTES, sleepRequest: null, worldEpoch: s.worldEpoch + 1 }));
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
