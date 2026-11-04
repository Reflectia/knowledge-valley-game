/**
 * Skill tree (spec §5): five branches, one per discipline branch, points only from
 * labs. Skills are learned by spending a branch's points in chain order. If a lab
 * is undone and points shrink, the last skills stop working until points return.
 */
import data from '../content/skills.json';

export interface SkillEffect {
  waterWide?: boolean;
  firstNightBoost?: boolean;
  seedOnHarvest?: boolean;
  golemWater?: number;
  golemHarvest?: boolean;
  maxEnergy?: number;
  shopDiscount?: number;
  blueprints?: boolean;
  toolEnergy?: number;
  swordBonus?: number;
  maxHealth?: number;
  spell?: string;
  alchemy?: boolean;
}

export interface SkillDef {
  id: string;
  cost: number;
  name: string;
  text: string;
  effect: SkillEffect;
  /** The effect arrives later: 'combat' (stage 8) or 'v0.2'. */
  later?: string;
}

export const BRANCHES: Record<string, SkillDef[]> = data.branches as Record<string, SkillDef[]>;

export function branchOf(skillId: string): string | undefined {
  return Object.keys(BRANCHES).find((b) => BRANCHES[b].some((s) => s.id === skillId));
}

/** Learned skills that are paid for by the branch points available now. */
export function activeSkills(learned: string[], points: Record<string, number>): string[] {
  const out: string[] = [];
  for (const [branch, skills] of Object.entries(BRANCHES)) {
    let budget = points[branch] ?? 0;
    for (const s of skills) {
      if (!learned.includes(s.id) || budget < s.cost) break;
      budget -= s.cost;
      out.push(s.id);
    }
  }
  return out;
}

/** Points of a branch not spent on its active skills. */
export function freePoints(branch: string, learned: string[], points: Record<string, number>): number {
  const active = new Set(activeSkills(learned, points));
  const spent = BRANCHES[branch]?.filter((s) => active.has(s.id)).reduce((n, s) => n + s.cost, 0) ?? 0;
  return (points[branch] ?? 0) - spent;
}

export type SkillState = 'learned' | 'available' | 'locked';

export function skillState(skillId: string, learned: string[], points: Record<string, number>): SkillState {
  const branch = branchOf(skillId);
  if (!branch) return 'locked';
  const active = activeSkills(learned, points);
  if (active.includes(skillId)) return 'learned';
  const chain = BRANCHES[branch];
  const i = chain.findIndex((s) => s.id === skillId);
  const prevOk = i === 0 || active.includes(chain[i - 1].id);
  return prevOk && freePoints(branch, learned, points) >= chain[i].cost ? 'available' : 'locked';
}

/** Learn a skill; returns the new learned list, or null when not available. */
export function learn(skillId: string, learned: string[], points: Record<string, number>): string[] | null {
  if (skillState(skillId, learned, points) !== 'available') return null;
  // Drop inactive leftovers of this branch first, so the chain stays consistent.
  const active = activeSkills(learned, points);
  return [...learned.filter((id) => active.includes(id) || branchOf(id) !== branchOf(skillId)), skillId];
}

export interface Effects {
  waterWide: boolean;
  firstNightBoost: boolean;
  seedOnHarvest: boolean;
  golemWater: number;
  golemHarvest: boolean;
  maxEnergyBonus: number;
  maxHealthBonus: number;
  shopDiscount: number;
  blueprints: boolean;
  toolEnergy: number;
  swordBonus: number;
}

export const NO_EFFECTS: Effects = {
  waterWide: false,
  firstNightBoost: false,
  seedOnHarvest: false,
  golemWater: 0,
  golemHarvest: false,
  maxEnergyBonus: 0,
  maxHealthBonus: 0,
  shopDiscount: 0,
  blueprints: false,
  toolEnergy: 0,
  swordBonus: 0,
};

/** Combined effects of the active skills. */
export function effectsOf(learned: string[], points: Record<string, number>): Effects {
  const fx: Effects = { ...NO_EFFECTS };
  const active = new Set(activeSkills(learned, points));
  for (const skills of Object.values(BRANCHES)) {
    for (const s of skills) {
      if (!active.has(s.id)) continue;
      const e = s.effect;
      if (e.waterWide) fx.waterWide = true;
      if (e.firstNightBoost) fx.firstNightBoost = true;
      if (e.seedOnHarvest) fx.seedOnHarvest = true;
      if (e.golemWater) fx.golemWater = Math.max(fx.golemWater, e.golemWater);
      if (e.golemHarvest) fx.golemHarvest = true;
      if (e.maxEnergy) fx.maxEnergyBonus += e.maxEnergy;
      if (e.maxHealth) fx.maxHealthBonus += e.maxHealth;
      if (e.shopDiscount) fx.shopDiscount = Math.max(fx.shopDiscount, e.shopDiscount);
      if (e.blueprints) fx.blueprints = true;
      if (e.toolEnergy) fx.toolEnergy += e.toolEnergy;
      if (e.swordBonus) fx.swordBonus += e.swordBonus;
    }
  }
  return fx;
}
