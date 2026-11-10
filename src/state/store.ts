import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';

import { markDone, setScore, unmarkDone } from '@/core/curriculum';
import { deriveProgress, pruneShown, reconcile, rewardKey, type DerivedProgress } from '@/core/rewards';
import { BALANCE } from '@/core/content';
import { applyDefeat, applyLoot, ENEMY_DEFS, rollLoot, type DefeatLoss } from '@/core/combat';
import { brew as brewPotion, drink as drinkPotion, findRecipe, hasBuff } from '@/core/alchemy';
import { bossFor, examState, payTrophies, syncUniques } from '@/core/exam';
import { nextArcBeat, toldWith } from '@/core/story';
import { growNight } from '@/core/homestead';
import { disciplineOfPack, dueLetters, mentorLines, type Letter } from '@/core/mentors';
import { effectsOf, learn, NO_EFFECTS, type Effects } from '@/core/skills';
import { atCeiling, gainXp, todayIso } from '@/core/rules';
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
export type SleepReason = 'bed' | 'late' | 'tired' | 'defeat';

/** A window the world asks the UI to open (the journal on the desk, the shop stall, the mailbox). */
export type UiRequest = 'journal' | 'shop' | 'mail' | 'alchemy';

/** A mentor talking: lines shown one by one in the dialog box. */
export interface Dialog {
  pack: string;
  lines: string[];
}

/** An exam boss just beaten: the victory scene shows it (session only; the win itself is saved). */
export interface ExamVictory {
  disciplineKey: string;
  pack: string;
  coins: number;
  xp: number;
}

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
  dialog: Dialog | null;
  /** What the last defeat cost (shown in the defeat dialog). */
  lastDefeat: DefeatLoss | null;
  /** Active skill effects (derived from learned skills and lab points). */
  effects: Effects;
  examVictory: ExamVictory | null;

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
  learnSkill(id: string): Promise<boolean>;
  /** Deliver letters due today (real date). Returns the new ones. */
  checkMail(): Promise<Letter[]>;
  readLetter(id: string): Promise<void>;
  /** A mentor speaks (in their location or visiting the homestead). */
  talkTo(pack: string): void;
  closeDialog(): void;
  /** An enemy hits the heroine. At zero health she is defeated (spec §4). */
  damagePlayer(amount: number): void;
  /**
   * An enemy is defeated: XP (up to the ceiling) and loot. In a location, with alchemy known, it may
   * leave the location's recipe. Returns the loot and the recipe found.
   */
  defeatEnemy(enemy: string, rng?: () => number, pack?: string): { coins: number; items: string[]; recipe?: string };
  /** Brew a potion at the alchemy lab (costs a little energy). Returns a reason on failure. */
  brew(id: string): string | null;
  /** Drink a potion from the bag. Returns a reason on failure. */
  drink(id: string): string | null;
  /**
   * The exam boss of a discipline is beaten (spec §4): the victory is saved at once, the trophy
   * goes to the bag, plus coins and XP. Does nothing unless the boss is ready today.
   */
  winExam(disciplineKey: string): Promise<boolean>;
  closeExamVictory(): void;
  /** A story scene has been shown; saved at once so it never repeats. */
  seeStory(id: string): Promise<void>;
  maxEnergy(): number;
  maxHealth(): number;
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
      const progress = deriveProgress(labs.curriculum, thresholds);
      // Trophies of won exams: paid once, also after a reload (the world is saved at night).
      const state = syncUniques(payTrophies(r.world, labs.exams ?? {}), progress.uniques);
      set((s) => ({
        labs,
        world: { state, ledger: r.ledger },
        progress,
        effects: effectsOf(labs.skills ?? [], progress.skillPoints),
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
      dialog: null,
      lastDefeat: null,
      effects: NO_EFFECTS,
      examVictory: null,

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
        const { world, progress, effects } = get();
        const cost = BALANCE.actions[kind];
        // Architecture «Міцні інструменти»: the axe and the pickaxe are lighter.
        const energyCost = Math.max(0, cost.energy - (kind === 'chop' || kind === 'mine' ? effects.toolEnergy : 0));
        if (world.state.player.energy < energyCost) return 'tired';
        const r = edit(world.state);
        if (!r.ok) return r.reason;
        const energy = r.world.player.energy - energyCost;
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

      maxEnergy: () => BALANCE.player.maxEnergy + get().effects.maxEnergyBonus,
      maxHealth: () => BALANCE.player.maxHealth + get().effects.maxHealthBonus,

      async learnSkill(id) {
        const { labs, progress } = get();
        const skills = learn(id, labs.skills ?? [], progress.skillPoints);
        if (!skills) return false;
        const next = { ...labs, skills };
        set({ labs: next, effects: effectsOf(skills, progress.skillPoints) });
        await persist(() => saves.saveLabs(next));
        return true;
      },

      async checkMail() {
        const { labs, progress } = get();
        const fresh = dueLetters(labs.curriculum, todayIso(now()), labs.mail ?? [], { progress: progress.disciplines, exams: labs.exams ?? {} });
        if (fresh.length === 0) return [];
        const next = { ...labs, mail: [...(labs.mail ?? []), ...fresh] };
        set({ labs: next });
        await persist(() => saves.saveLabs(next));
        return fresh;
      },

      async readLetter(id) {
        const { labs } = get();
        if (!labs.mail.some((l) => l.id === id && !l.read)) return;
        const next = { ...labs, mail: labs.mail.map((l) => (l.id === id ? { ...l, read: true } : l)) };
        set({ labs: next });
        await persist(() => saves.saveLabs(next));
      },

      talkTo(pack) {
        const { labs, world, progress } = get();
        const seen = labs.mentorSeen ?? {};
        const today = todayIso(now());
        // The next step of the mentor's semester arc, told once.
        const d = disciplineOfPack(labs.curriculum, pack);
        const arcSeen = labs.arcSeen ?? {};
        const beat = d ? nextArcBeat(d, progress.disciplines[d.key], today, labs.exams ?? {}, arcSeen[d.key] ?? []) : null;
        const { lines, done, told: beatTold } = mentorLines(pack, {
          beat,
          curriculum: labs.curriculum,
          today,
          name: world.state.player.name,
          atCeiling: atCeiling(world.state.player, progress.ceiling),
          seenDone: seen[pack] ?? 0,
          day: world.state.day,
          firstMeeting: seen[pack] === undefined,
        });
        if (lines.length === 0) return;
        const told = d && beatTold ? { ...arcSeen, [d.key]: [...new Set([...(arcSeen[d.key] ?? []), ...toldWith(beatTold)])] } : arcSeen;
        const next = { ...labs, mentorSeen: { ...seen, [pack]: done }, arcSeen: told };
        set({ dialog: { pack, lines }, labs: next });
        void persist(() => saves.saveLabs(next));
      },

      closeDialog: () => set({ dialog: null }),

      damagePlayer(amount) {
        const { world, sleepRequest } = get();
        if (sleepRequest) return;
        const health = Math.max(0, world.state.player.health - Math.max(0, amount));
        if (health > 0) {
          set({ world: { ...world, state: { ...world.state, player: { ...world.state.player, health } } } });
          return;
        }
        // Defeat: carried home, part of the resources lost, the day ends.
        const { world: after, lost } = applyDefeat({ ...world.state, player: { ...world.state.player, health: 0 } });
        set({ world: { ...world, state: after }, lastDefeat: lost, sleepRequest: 'defeat', dialog: null });
      },

      defeatEnemy(enemy, rng = Math.random, pack) {
        const { world, progress, effects } = get();
        const loot = rollLoot(enemy, rng);
        let next = applyLoot(world.state, loot);
        const player = gainXp(next.player, ENEMY_DEFS[enemy]?.xp ?? 0, progress.ceiling);
        const recipe = pack && effects.alchemy ? findRecipe(next, pack, rng) : null;
        if (recipe) next = { ...next, recipes: [...(next.recipes ?? []), recipe] };
        set({ world: { ...world, state: { ...next, player } } });
        return recipe ? { ...loot, recipe } : loot;
      },

      brew(id) {
        if (!get().effects.alchemy) return 'noAlchemy';
        return get().act('brew', (w) => brewPotion(w, id));
      },

      drink(id) {
        const s = get();
        return s.editWorld((w) => drinkPotion(w, id, { maxEnergy: s.maxEnergy(), maxHealth: s.maxHealth(), ceiling: s.progress.ceiling }));
      },

      async winExam(key) {
        const { labs, world, progress } = get();
        const d = labs.curriculum.disciplines[key];
        const today = todayIso(now());
        const won = labs.exams ?? {};
        if (!d || examState(d, progress.disciplines[key], today, won) !== 'ready') return false;
        const boss = bossFor(d.pack)!;
        const exams = { ...won, [key]: { date: today, pack: d.pack } };
        const nextLabs = { ...labs, exams };
        const paid = payTrophies(world.state, exams);
        const player = gainXp({ ...paid.player, coins: paid.player.coins + boss.coins }, boss.xp, progress.ceiling);
        set({
          labs: nextLabs,
          world: { ...world, state: { ...paid, player } },
          examVictory: { disciplineKey: key, pack: d.pack, coins: boss.coins, xp: boss.xp },
        });
        await persist(() => saves.saveLabs(nextLabs));
        return true;
      },

      closeExamVictory: () => set({ examVictory: null }),

      async seeStory(id) {
        const { labs } = get();
        if ((labs.story ?? []).includes(id)) return;
        const next = { ...labs, story: [...(labs.story ?? []), id] };
        set({ labs: next });
        await persist(() => saves.saveLabs(next));
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
        // Night: the golem helps, watered crops grow, the soil dries.
        // The growth potion adds a day to every watered crop tonight.
        const fx = get().effects;
        const grown = growNight(world.state, hasBuff(world.state, 'growth') ? { ...fx, growthBonus: fx.growthBonus + 1 } : fx);
        const state = {
          ...grown,
          // Potion effects last until sleep.
          buffs: [],
          day: world.state.day + 1,
          player: { ...grown.player, energy: get().maxEnergy(), health: get().maxHealth() },
        };
        const next = { ...world, state };
        set((s) => ({ world: next, clockMinutes: DAY_START_MINUTES, sleepRequest: null, lastDefeat: null, worldEpoch: s.worldEpoch + 1 }));
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
        const progress = deriveProgress(file.labs.curriculum, file.labs.settings.rarityThresholds);
        set({
          labs: file.labs,
          world: { ...file.world, state: syncUniques(file.world.state, progress.uniques) },
          progress,
          effects: effectsOf(file.labs.skills ?? [], progress.skillPoints),
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
