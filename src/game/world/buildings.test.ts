import { buildingTiles, wallRows } from './buildings';

describe('discipline building levels', () => {
  it('level 0 is an empty plot', () => {
    expect(buildingTiles(0, 'red')).toBeNull();
  });

  it('every level is at least as big as the previous one and rectangular', () => {
    let lastArea = 0;
    for (let level = 1; level <= 5; level++) {
      const rows = buildingTiles(level, 'red')!;
      const w = rows[0].length;
      expect(rows.every((r) => r.length === w)).toBe(true);
      const area = w * rows.length;
      expect(area).toBeGreaterThan(lastArea);
      lastArea = area;
    }
  });

  it('styles change roof and wall tiles', () => {
    expect(buildingTiles(3, 'red')![0]).not.toEqual(buildingTiles(3, 'gray')![0]);
    expect(buildingTiles(3, 'mixed')!.at(-1)).toEqual(buildingTiles(3, 'red')!.at(-1));
    expect(wallRows(5)).toBe(2);
  });
});
