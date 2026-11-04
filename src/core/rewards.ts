/**
 * Lab rewards (spec §6) without duplication.
 *
 * Two kinds of rewards:
 * - Derived: skill points, revival, building levels, level ceiling, unique items,
 *   knowledge-shield charges. They are recomputed from the lab records every time
 *   (`deriveProgress`), so edits and re-imports can never count anything twice.
 * - Granted: coins and resources go into the wallet and can be spent. Each lab's
 *   share is recorded in the ledger; `reconcile` pays only the difference between
 *   what a lab is worth now and what it has already paid.
 */
import { BALANCE, getPack, uniqueItemFor } from './content';
import { buildingLevel, isOnTime, levelCeiling, rarityFor, revival } from './rules';
import type {
  Curriculum,
  DisciplineKey,
  LabKey,
  LedgerEntry,
  Rarity,
  RarityThresholds,
  RewardEvent,
  RewardLedger,
  WorldState,
} from './types';

export interface UniqueItem {
  itemId: string;
  labKey: LabKey;
  rarity: Rarity;
}

export interface DisciplineProgress {
  done: number;
  total: number;
  revivalStage: number;
  revivalProgress: number;
  buildingLevel: number;
  /** On-time labs: knowledge-shield charges for the exam boss. */
  shieldCharges: number;
  allDone: boolean;
}

export interface DerivedProgress {
  doneLabs: number;
  ceiling: number;
  /** Skill points by branch id (modeling, ai, …). */
  skillPoints: Record<string, number>;
  disciplines: Record<DisciplineKey, DisciplineProgress>;
  uniques: UniqueItem[];
  /** Branch with the most points; decides the title (null when no lab is done). */
  topBranch: string | null;
}

/** What one lab is worth right now. */
export interface LabWorth extends LedgerEntry {
  branch: string;
  itemId?: string;
  shieldCharges: number;
}

export function labWorth(curriculum: Curriculum, labKey: LabKey, thresholds: RarityThresholds): LabWorth {
  const lab = curriculum.labs[labKey];
  const discipline = curriculum.disciplines[lab.disciplineKey];
  const pack = getPack(discipline.pack);
  const r = BALANCE.rewards;
  const done = Boolean(lab.doneDate);
  const onTime = done && isOnTime(lab);
  const graded = done && lab.score !== undefined;
  return {
    done,
    onTime,
    branch: pack.branch.id,
    rarity: graded ? rarityFor(lab.score!, lab.maxScore, thresholds) : undefined,
    itemId: graded ? uniqueItemFor(pack, lab.labNo) : undefined,
    coins: done ? r.done.coins + (onTime ? r.onTime.coins : 0) : 0,
    resources: done ? { [pack.resource.id]: r.done.resources } : {},
    shieldCharges: onTime ? r.onTime.shieldCharges : 0,
  };
}

export function deriveProgress(curriculum: Curriculum, thresholds: RarityThresholds): DerivedProgress {
  const skillPoints: Record<string, number> = {};
  const disciplines: Record<DisciplineKey, DisciplineProgress> = {};
  const uniques: UniqueItem[] = [];
  let doneLabs = 0;

  for (const d of Object.values(curriculum.disciplines)) {
    skillPoints[getPack(d.pack).branch.id] ??= 0;
    disciplines[d.key] = {
      done: 0,
      total: 0,
      revivalStage: 1,
      revivalProgress: 0,
      buildingLevel: 0,
      shieldCharges: 0,
      allDone: false,
    };
  }

  for (const lab of Object.values(curriculum.labs)) {
    const p = disciplines[lab.disciplineKey];
    p.total += 1;
    const w = labWorth(curriculum, lab.key, thresholds);
    if (!w.done) continue;
    doneLabs += 1;
    p.done += 1;
    p.shieldCharges += w.shieldCharges;
    skillPoints[w.branch] += BALANCE.rewards.done.skillPoints;
    if (w.rarity && w.itemId) uniques.push({ itemId: w.itemId, labKey: lab.key, rarity: w.rarity });
  }

  for (const p of Object.values(disciplines)) {
    const rv = revival(p.done, p.total);
    p.revivalStage = rv.stage;
    p.revivalProgress = rv.progress;
    p.buildingLevel = buildingLevel(p.done, p.total);
    p.allDone = p.total > 0 && p.done === p.total;
  }

  let topBranch: string | null = null;
  for (const [branch, pts] of Object.entries(skillPoints)) {
    if (pts > 0 && (topBranch === null || pts > skillPoints[topBranch])) topBranch = branch;
  }

  uniques.sort((a, b) => a.labKey.localeCompare(b.labKey));
  return { doneLabs, ceiling: levelCeiling(doneLabs), skillPoints, disciplines, uniques, topBranch };
}

export interface ReconcileResult {
  world: WorldState;
  ledger: RewardLedger;
  /** New reward moments, in lab order: show one scene, or a batch for several. */
  events: RewardEvent[];
}

const EMPTY: LedgerEntry = { done: false, onTime: false, coins: 0, resources: {} };

/**
 * Bring the wallet and the ledger in line with the lab records.
 * - Pays the difference in coins/resources for every lab (never below zero in the wallet).
 * - Emits a `done` event when a lab becomes done, and a `graded` event when it gets
 *   a rarity for the first time or its rarity changes (score edited).
 * Calling it twice in a row changes nothing the second time.
 */
export function reconcile(
  curriculum: Curriculum,
  ledger: RewardLedger,
  world: WorldState,
  thresholds: RarityThresholds,
): ReconcileResult {
  const nextLedger: RewardLedger = {};
  const inventory = { ...world.inventory };
  let coins = world.player.coins;
  const events: RewardEvent[] = [];

  const keys = new Set([...Object.keys(curriculum.labs), ...Object.keys(ledger)]);
  for (const key of [...keys].sort()) {
    const prev = ledger[key] ?? EMPTY;
    const lab = curriculum.labs[key];
    const now: LabWorth | null = lab ? labWorth(curriculum, key, thresholds) : null;
    const target: LedgerEntry = now
      ? { done: now.done, onTime: now.onTime, rarity: now.rarity, coins: now.coins, resources: now.resources }
      : EMPTY;

    const dCoins = target.coins - prev.coins;
    coins = Math.max(0, coins + dCoins);
    const resIds = new Set([...Object.keys(prev.resources), ...Object.keys(target.resources)]);
    const dRes: Record<string, number> = {};
    for (const id of resIds) {
      const d = (target.resources[id] ?? 0) - (prev.resources[id] ?? 0);
      if (d === 0) continue;
      dRes[id] = d;
      const left = Math.max(0, (inventory[id] ?? 0) + d);
      if (left === 0) delete inventory[id];
      else inventory[id] = left;
    }

    if (now && now.done && !prev.done) {
      events.push({
        kind: 'done',
        labKey: key,
        onTime: now.onTime,
        branch: now.branch,
        coins: Math.max(0, dCoins),
        resources: Object.fromEntries(Object.entries(dRes).filter(([, v]) => v > 0)),
        shieldCharges: now.shieldCharges,
      });
    }
    if (now && now.rarity && now.itemId && now.rarity !== prev.rarity) {
      events.push({ kind: 'graded', labKey: key, rarity: now.rarity, itemId: now.itemId });
    }

    if (lab) nextLedger[key] = target;
  }

  return {
    world: { ...world, player: { ...world.player, coins }, inventory },
    ledger: nextLedger,
    events,
  };
}
