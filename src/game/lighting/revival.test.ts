import { REVIVAL_TOKENS, revivalFilter, revivalMatrix } from './revival';

describe('revival filter', () => {
  it('starts at revival-1 and ends at revival-5', () => {
    expect(revivalFilter(0)).toEqual({ saturate: 0.1, brightness: 0.8 });
    expect(revivalFilter(1)).toEqual({ saturate: 1, brightness: 1 });
  });

  it('hits the middle tokens exactly at 25 / 50 / 75 %', () => {
    [0.25, 0.5, 0.75].forEach((p, i) => {
      const f = revivalFilter(p);
      expect(f.saturate).toBeCloseTo(REVIVAL_TOKENS[i + 1][0], 10);
      expect(f.brightness).toBeCloseTo(REVIVAL_TOKENS[i + 1][1], 10);
    });
  });

  it('every lab of a 5-lab discipline changes the look', () => {
    const looks = [0, 1, 2, 3, 4, 5].map((d) => revivalFilter(d / 5).saturate);
    expect(new Set(looks).size).toBe(6);
    expect(looks).toEqual([...looks].sort((a, b) => a - b));
  });

  it('full revival is the identity matrix', () => {
    const m = revivalMatrix(1);
    const id = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    m.forEach((v, i) => expect(v).toBeCloseTo(id[i], 10));
  });

  it('grey start keeps luminance-weighted rows (CSS saturate)', () => {
    const m = revivalMatrix(0);
    // Row sums equal the brightness: a grey pixel stays grey, just darker.
    for (const row of [0, 5, 10]) expect(m[row] + m[row + 1] + m[row + 2]).toBeCloseTo(0.8, 10);
  });
});
