import { worldScaleFor } from './constants';

describe('worldScaleFor', () => {
  it('uses x3 at the minimum 1280×720 screen', () => {
    expect(worldScaleFor(1280, 720)).toBe(3);
  });

  it('uses x4 from 1920×1080', () => {
    expect(worldScaleFor(1920, 1080)).toBe(4);
    expect(worldScaleFor(2560, 1440)).toBe(4);
  });

  it('stays at x3 when only one dimension is large enough', () => {
    expect(worldScaleFor(1920, 1000)).toBe(3);
  });
});
