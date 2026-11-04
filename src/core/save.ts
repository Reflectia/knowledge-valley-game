/**
 * Save format, migrations and storage (spec §9).
 *
 * Two records, saved at different times:
 * - "labs": curriculum and settings — written immediately on every change, so
 *   closing the tab mid-day never loses lab data;
 * - "world": world state plus the reward ledger it was paid against — written
 *   every night when the heroine sleeps.
 * On load, `reconcile` compares the saved ledger with the labs and pays whatever
 * was earned after the last night, so lab rewards survive a closed tab without
 * ever being paid twice. Export/import puts both into one versioned .json file.
 */
import { BALANCE } from './content';
import { EMPTY_CURRICULUM } from './curriculum';
import type { Curriculum, RewardLedger, Settings, WorldState } from './types';

export const SAVE_VERSION = 1;

export interface LabsRecord {
  curriculum: Curriculum;
  settings: Settings;
}

export interface WorldRecord {
  state: WorldState;
  /** Rewards already paid into `state` (coins, resources), per lab. */
  ledger: RewardLedger;
}

export interface SaveFile {
  game: 'knowledge-valley';
  version: number;
  savedAt: string;
  labs: LabsRecord;
  world: WorldRecord;
}

export function newWorld(name = ''): WorldState {
  const p = BALANCE.player;
  return {
    day: 1,
    player: {
      name,
      appearance: { hair: 'red', skin: 'light', shirt: 'green' },
      level: p.startLevel,
      xp: 0,
      coins: 0,
      energy: p.maxEnergy,
      health: p.maxHealth,
    },
    inventory: {},
  };
}

export function newLabs(now = new Date()): LabsRecord {
  return {
    curriculum: EMPTY_CURRICULUM,
    settings: { rarityThresholds: { ...BALANCE.rarityThresholds }, createdAt: now.toISOString() },
  };
}

// ----------------------------------------------------------------- migrations

/** Upgrades a save from version N to N + 1. Add one entry per format change. */
export type Migration = (save: Record<string, unknown>) => Record<string, unknown>;
export const MIGRATIONS: Record<number, Migration> = {
  // 1: (save) => ({ ...save, version: 2, ... }),
};

export class SaveError extends Error {}

export function migrate(
  raw: unknown,
  migrations: Record<number, Migration> = MIGRATIONS,
  target = SAVE_VERSION,
): SaveFile {
  if (!raw || typeof raw !== 'object') throw new SaveError('Not a save file');
  let save = raw as Record<string, unknown>;
  if (save.game !== 'knowledge-valley') throw new SaveError('Not a save file of this game');
  if (typeof save.version !== 'number') throw new SaveError('Save file has no version');
  let version: number = save.version;
  if (version > target) throw new SaveError(`Save is from a newer game version (${version})`);
  while (version < target) {
    const step = migrations[version];
    if (!step) throw new SaveError(`No migration from version ${version}`);
    save = step(save);
    version = save.version as number;
  }
  const file = save as unknown as SaveFile;
  if (!file.labs?.curriculum || !file.labs.settings || !file.world?.state?.player || !file.world.ledger) {
    throw new SaveError('Save file is incomplete');
  }
  return file;
}

export function toSaveFile(labs: LabsRecord, world: WorldRecord, now = new Date()): SaveFile {
  return { game: 'knowledge-valley', version: SAVE_VERSION, savedAt: now.toISOString(), labs, world };
}

/** Parse an imported .json file (string) into the current save format. */
export function parseSaveFile(text: string): SaveFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SaveError('The file is not valid JSON');
  }
  return migrate(raw);
}

// ----------------------------------------------------------------- storage

/** Minimal key-value storage; IndexedDB in the browser, a Map in tests. */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

const KEY_LABS = 'kv:labs';
const KEY_WORLD = 'kv:world';

interface Stored<T> {
  game: 'knowledge-valley';
  version: number;
  data: T;
}

export class SaveStore {
  constructor(private readonly kv: KeyValueStore) {}

  saveLabs(labs: LabsRecord): Promise<void> {
    return this.kv.set(KEY_LABS, { game: 'knowledge-valley', version: SAVE_VERSION, data: labs });
  }

  saveWorld(world: WorldRecord): Promise<void> {
    return this.kv.set(KEY_WORLD, { game: 'knowledge-valley', version: SAVE_VERSION, data: world });
  }

  /** Load both records (migrated). Returns null when there is no saved game. */
  async load(): Promise<SaveFile | null> {
    const labs = await this.kv.get<Stored<LabsRecord>>(KEY_LABS);
    const world = await this.kv.get<Stored<WorldRecord>>(KEY_WORLD);
    if (!labs && !world) return null;
    // Stored records share the save version; migrate them together as one file.
    const version = Math.min(labs?.version ?? SAVE_VERSION, world?.version ?? SAVE_VERSION);
    return migrate({
      game: 'knowledge-valley',
      version,
      savedAt: new Date().toISOString(),
      labs: labs?.data ?? newLabs(),
      world: world?.data ?? { state: newWorld(), ledger: {} },
    });
  }

  /** Replace everything (import of an exported .json). */
  async replace(file: SaveFile): Promise<void> {
    await this.saveLabs(file.labs);
    await this.saveWorld(file.world);
  }
}

export function memoryStore(): KeyValueStore {
  const m = new Map<string, unknown>();
  return {
    get: async <T>(k: string) => structuredClone(m.get(k)) as T | undefined,
    set: async (k, v) => {
      m.set(k, structuredClone(v));
    },
  };
}
