import { activeSkills, BRANCHES, effectsOf, freePoints, learn, skillState } from './skills';

describe('skill tree', () => {
  it('has five branches with a chain of skills', () => {
    expect(Object.keys(BRANCHES).sort()).toEqual(['ai', 'architecture', 'management', 'modeling', 'science']);
    for (const chain of Object.values(BRANCHES)) expect(chain.length).toBeGreaterThanOrEqual(3);
  });

  it('learns in chain order with branch points from labs', () => {
    const pts = { management: 3 };
    expect(skillState('time-management', [], pts)).toBe('available');
    expect(skillState('bargaining', [], pts)).toBe('locked');
    let learned = learn('time-management', [], pts)!;
    expect(skillState('bargaining', learned, pts)).toBe('available');
    learned = learn('bargaining', learned, pts)!;
    expect(freePoints('management', learned, pts)).toBe(0);
    expect(skillState('priorities', learned, pts)).toBe('locked');
    expect(learn('priorities', learned, pts)).toBeNull();
  });

  it('skills stop working when points shrink (a lab undone)', () => {
    const learned = ['time-management', 'bargaining'];
    expect(activeSkills(learned, { management: 3 })).toEqual(learned);
    expect(activeSkills(learned, { management: 2 })).toEqual(['time-management']);
    expect(effectsOf(learned, { management: 2 }).shopDiscount).toBe(0);
  });

  it('combines effects', () => {
    const fx = effectsOf(['time-management', 'bargaining', 'priorities', 'golem-water'], { management: 5, ai: 1 });
    expect(fx.maxEnergyBonus).toBe(30);
    expect(fx.shopDiscount).toBe(0.15);
    expect(fx.golemWater).toBe(6);
  });
});
