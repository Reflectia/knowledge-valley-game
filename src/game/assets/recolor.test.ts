import { buildSwapTable, recolorPixels, type HeroinePalettes } from './recolor';

const palettes: HeroinePalettes = {
  hair: { base: ['#ff0000', '#800000'], options: { red: ['#ff0000', '#800000'], blond: ['#ffee00', '#887700'] } },
  skin: { base: ['#ffccaa'], options: { light: ['#ffccaa'], dark: ['#664433'] } },
  shirt: { base: ['#00ff00'], options: { green: ['#00ff00'], blue: ['#0000ff'] } },
};

describe('heroine recolor', () => {
  it('replaces every role ramp with the chosen option, keeping order', () => {
    const table = buildSwapTable(palettes, { hair: 'blond', skin: 'dark', shirt: 'blue' });
    const px = new Uint8ClampedArray([
      255, 0, 0, 255, // hair light
      128, 0, 0, 255, // hair dark
      255, 204, 170, 255, // skin
      0, 255, 0, 255, // shirt
      10, 20, 30, 255, // not in any role
    ]);
    recolorPixels(px, table);
    expect(Array.from(px)).toEqual([
      255, 238, 0, 255,
      136, 119, 0, 255,
      102, 68, 51, 255,
      0, 0, 255, 255,
      10, 20, 30, 255,
    ]);
  });

  it('leaves transparent pixels untouched', () => {
    const table = buildSwapTable(palettes, { hair: 'blond', skin: 'light', shirt: 'green' });
    const px = new Uint8ClampedArray([255, 0, 0, 0]);
    recolorPixels(px, table);
    expect(Array.from(px)).toEqual([255, 0, 0, 0]);
  });

  it('rejects unknown options', () => {
    expect(() => buildSwapTable(palettes, { hair: 'pink', skin: 'light', shirt: 'green' })).toThrow(/hair/);
  });
});
