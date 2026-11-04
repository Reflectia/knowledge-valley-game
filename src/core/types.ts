/**
 * Core game data. Plain JSON-serializable objects only: everything here is
 * saved to IndexedDB and exported to .json.
 */

/** Calendar date in local time, `YYYY-MM-DD` (import format, spec §7). */
export type ISODate = string;

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];

/** `${semester}:${disciplineId}:${labNo}` — the import upsert key (spec §7). */
export type LabKey = string;
/** `${semester}:${disciplineId}`. */
export type DisciplineKey = string;

export interface Discipline {
  key: DisciplineKey;
  semester: number;
  id: string;
  /** Shown as imported, never translated (spec §8). */
  name: string;
  pack: string;
  hasExam: boolean;
  examDate?: ISODate;
}

export interface Lab {
  key: LabKey;
  disciplineKey: DisciplineKey;
  semester: number;
  disciplineId: string;
  labNo: number;
  title?: string;
  maxScore: number;
  deadline?: ISODate;
  /** Set by «Виконано» (stage 1 of a lab). */
  doneDate?: ISODate;
  /** Set by «Ввести бал» (stage 2); only allowed when done. */
  score?: number;
}

export interface Curriculum {
  disciplines: Record<DisciplineKey, Discipline>;
  labs: Record<LabKey, Lab>;
}

/**
 * What has already been granted for each lab. Stackable rewards (coins,
 * resources) are paid as the difference between what a lab should give now
 * and what this ledger says it gave, so re-imports and edits never duplicate.
 */
export interface LedgerEntry {
  done: boolean;
  onTime: boolean;
  rarity?: Rarity;
  coins: number;
  resources: Record<string, number>;
}
export type RewardLedger = Record<LabKey, LedgerEntry>;

export interface RarityThresholds {
  /** Minimum score / max for each rarity above common (inclusive). */
  rare: number;
  epic: number;
  legendary: number;
}

export interface Settings {
  rarityThresholds: RarityThresholds;
  /** ISO timestamp of the last .json export; drives the weekly reminder. */
  lastExportAt?: string;
  /** When this save was started; the first reminder counts from here. */
  createdAt: string;
}

export interface PlayerState {
  name: string;
  appearance: { hair: string; skin: string; shirt: string };
  level: number;
  /** Experience inside the current level. */
  xp: number;
  coins: number;
  energy: number;
  health: number;
}

/** World state: saved every night when the heroine goes to sleep. */
export interface WorldState {
  day: number;
  player: PlayerState;
  inventory: Record<string, number>;
}

/** One reward moment for the reward scene (single or batched retroactive). */
export type RewardEvent =
  | {
      kind: 'done';
      labKey: LabKey;
      onTime: boolean;
      branch: string;
      coins: number;
      resources: Record<string, number>;
      shieldCharges: number;
    }
  | { kind: 'graded'; labKey: LabKey; rarity: Rarity; itemId: string };
