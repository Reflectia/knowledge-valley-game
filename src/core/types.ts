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
  /** Unknown until the teacher publishes it; a score can only be set once it is known. */
  maxScore?: number;
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

export type UiScale = 'auto' | 2 | 3 | 4;

export interface Volume {
  /** 0..100 */
  master: number;
  music: number;
  sfx: number;
}

export interface Settings {
  rarityThresholds: RarityThresholds;
  volume: Volume;
  uiScale: UiScale;
  language: 'uk' | 'en';
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

/** A garden tile on the homestead: tilled soil, maybe with a crop. */
export interface Plot {
  crop?: string;
  /** Watered days the crop has grown. */
  growth: number;
  wateredToday: boolean;
}

/** A placed piece of furniture or outdoor decor (tile coordinates on a map). */
export interface Placed {
  uid: number;
  item: string;
  map: string;
  x: number;
  y: number;
}

/** World state: saved every night when the heroine goes to sleep. */
export interface WorldState {
  day: number;
  player: PlayerState;
  /** Item id → count. */
  inventory: Record<string, number>;
  /** Toolbar slots 1–9: item ids (or empty). */
  toolbar: (string | null)[];
  /** Garden tiles on the homestead by "x,y". */
  plots: Record<string, Plot>;
  decor: Placed[];
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
