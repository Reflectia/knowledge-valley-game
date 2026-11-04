import { BALANCE, PACKS } from './content';
import { markDone, setScore, unmarkDone } from './curriculum';
import { deriveProgress, reconcile } from './rewards';
import { newWorld } from './save';
import { sampleCurriculum } from './testing';
import type { Curriculum, RewardLedger, WorldState } from './types';

const T = BALANCE.rarityThresholds;
const R = BALANCE.rewards;
const L1 = '1:mpm_ai:1';
const L2 = '1:mpm_ai:2';

function run(c: Curriculum, ledger: RewardLedger = {}, world: WorldState = newWorld()) {
  return reconcile(c, ledger, world, T);
}

describe('content', () => {
  it('has the five semester-1 packs with five unique items each', () => {
    expect(Object.keys(PACKS).sort()).toEqual(['forest', 'forge', 'library', 'market', 'tower']);
    for (const p of Object.values(PACKS)) expect(p.uniques).toHaveLength(5);
  });
});

describe('«Виконано» (acceptance: skill point, stage, building, ceiling)', () => {
  it('gives a branch point, revival, a building level and raises the ceiling', () => {
    const before = deriveProgress(sampleCurriculum(), T);
    const after = deriveProgress(markDone(sampleCurriculum(), L1, '2026-09-23'), T);
    expect(after.skillPoints.modeling).toBe(before.skillPoints.modeling + 1);
    expect(after.disciplines['1:mpm_ai'].revivalProgress).toBeGreaterThan(before.disciplines['1:mpm_ai'].revivalProgress);
    expect(after.disciplines['1:mpm_ai'].buildingLevel).toBe(before.disciplines['1:mpm_ai'].buildingLevel + 1);
    expect(after.ceiling).toBe(before.ceiling + BALANCE.ceiling.perLab);
    expect(after.topBranch).toBe('modeling');
  });

  it('pays coins and the pack resource once, with an on-time bonus', () => {
    const r = run(markDone(sampleCurriculum(), L1, '2026-09-23'));
    expect(r.world.player.coins).toBe(R.done.coins + R.onTime.coins);
    expect(r.world.inventory['forest-moss']).toBe(R.done.resources);
    expect(r.events).toEqual([
      expect.objectContaining({ kind: 'done', labKey: L1, onTime: true, branch: 'modeling', shieldCharges: 1 }),
    ]);
  });

  it('a late lab gets all main rewards but no on-time bonus (no penalty)', () => {
    const c = markDone(sampleCurriculum(), L2, '2026-10-18'); // deadline 10-16
    const r = run(c);
    expect(r.world.player.coins).toBe(R.done.coins);
    expect(deriveProgress(c, T).skillPoints.modeling).toBe(1);
    expect(deriveProgress(c, T).disciplines['1:mpm_ai'].shieldCharges).toBe(0);
  });
});

describe('«Ввести бал» (acceptance: rarity by threshold)', () => {
  it('gives the pack unique item for that lab with the right rarity', () => {
    let c = markDone(sampleCurriculum(), L1, '2026-09-23');
    c = setScore(c, L1, 9);
    expect(deriveProgress(c, T).uniques).toEqual([{ itemId: 'forest-unique-1', labKey: L1, rarity: 'legendary' }]);
    const r = run(c);
    expect(r.events.map((e) => e.kind)).toEqual(['done', 'graded']);
  });

  it('refuses a score before «Виконано» and outside 0..max', () => {
    expect(() => setScore(sampleCurriculum(), L1, 5)).toThrow();
    const c = markDone(sampleCurriculum(), L1, '2026-09-23');
    expect(() => setScore(c, L1, 11)).toThrow();
    expect(() => setScore(c, L1, -1)).toThrow();
  });
});

describe('no duplicated rewards (acceptance)', () => {
  it('reconciling twice changes nothing the second time', () => {
    const c = setScore(markDone(sampleCurriculum(), L1, '2026-09-23'), L1, 9);
    const first = run(c);
    const second = run(c, first.ledger, first.world);
    expect(second.world).toEqual(first.world);
    expect(second.events).toEqual([]);
  });

  it('a re-import of the same data does not pay again', () => {
    const c = markDone(sampleCurriculum(), L1, '2026-09-23');
    const first = run(c);
    const reimported = structuredClone(c);
    expect(run(reimported, first.ledger, first.world).world.player.coins).toBe(first.world.player.coins);
  });

  it('editing a score swaps the rarity of the same item, no second item', () => {
    let c = setScore(markDone(sampleCurriculum(), L1, '2026-09-23'), L1, 5);
    const first = run(c);
    c = setScore(c, L1, 9.5);
    const second = run(c, first.ledger, first.world);
    expect(deriveProgress(c, T).uniques).toHaveLength(1);
    expect(deriveProgress(c, T).uniques[0].rarity).toBe('legendary');
    expect(second.events).toEqual([{ kind: 'graded', labKey: L1, rarity: 'legendary', itemId: 'forest-unique-1' }]);
    expect(second.world.player.coins).toBe(first.world.player.coins);
  });

  it('fixing a done date to a late one takes back only the on-time bonus', () => {
    let c = markDone(sampleCurriculum(), L1, '2026-09-23');
    const first = run(c);
    c = markDone(c, L1, '2026-09-30');
    const second = run(c, first.ledger, first.world);
    expect(second.world.player.coins).toBe(R.done.coins);
    expect(second.events).toEqual([]);
  });

  it('undoing «Виконано» takes the lab rewards back, never below zero', () => {
    let c = markDone(sampleCurriculum(), L1, '2026-09-23');
    const first = run(c);
    const spent = { ...first.world, player: { ...first.world.player, coins: 10 } };
    c = unmarkDone(c, L1);
    const second = run(c, first.ledger, spent);
    expect(second.world.player.coins).toBe(0);
    expect(second.world.inventory['forest-moss']).toBeUndefined();
    expect(deriveProgress(c, T).ceiling).toBe(BALANCE.ceiling.base);
  });
});

describe('retroactive labs (acceptance: on time by done date)', () => {
  it('several old labs at once: full rewards and one event per lab in order', () => {
    let c = sampleCurriculum();
    c = markDone(c, L1, '2026-09-23');
    c = setScore(c, L1, 9);
    c = markDone(c, '1:ai_iit:1', '2026-10-01');
    c = setScore(c, '1:ai_iit:1', 8);
    c = markDone(c, L2, '2026-10-18');
    const r = run(c);
    expect(r.events.map((e) => [e.kind, e.labKey])).toEqual([
      ['done', '1:ai_iit:1'],
      ['graded', '1:ai_iit:1'],
      ['done', L1],
      ['graded', L1],
      ['done', L2],
    ]);
    const onTime = r.events.filter((e) => e.kind === 'done' && e.onTime).map((e) => e.labKey);
    expect(onTime).toEqual(['1:ai_iit:1', L1]);
    expect(deriveProgress(c, T).ceiling).toBe(BALANCE.ceiling.base + 3 * BALANCE.ceiling.perLab);
  });
});
