import { INNER_RING, paintLightmap } from './lightmap';

const AMBIENT = 0x101010;
const WARM = 0xffc861;

function pixel(data: Uint8ClampedArray, w: number, x: number, y: number): number {
  const i = (y * w + x) * 4;
  return (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
}

describe('paintLightmap', () => {
  const W = 41;
  const H = 41;
  const light = { x: 20.5, y: 20.5, radius: 20, color: WARM };

  it('fills the map with the ambient color when there are no lights', () => {
    const data = new Uint8ClampedArray(W * H * 4);
    paintLightmap(data, W, H, AMBIENT, []);
    expect(pixel(data, W, 0, 0)).toBe(AMBIENT);
    expect(pixel(data, W, 40, 40)).toBe(AMBIENT);
    expect(data[3]).toBe(255);
  });

  it('lights the inner ring fully', () => {
    const data = new Uint8ClampedArray(W * H * 4);
    paintLightmap(data, W, H, AMBIENT, [light]);
    const innerEdge = Math.floor(20 * INNER_RING) - 1;
    expect(pixel(data, W, 20, 20)).toBe(WARM);
    expect(pixel(data, W, 20 + innerEdge, 20)).toBe(WARM);
    expect(pixel(data, W, 20 + innerEdge, 21)).toBe(WARM);
  });

  it('dithers the outer ring as a checkerboard', () => {
    const data = new Uint8ClampedArray(W * H * 4);
    paintLightmap(data, W, H, AMBIENT, [light]);
    // x = 36 is in the outer ring (distance 16 of 20).
    const a = pixel(data, W, 36, 20);
    const b = pixel(data, W, 36, 21);
    expect(new Set([a, b])).toEqual(new Set([WARM, AMBIENT]));
  });

  it('leaves pixels outside the radius dark', () => {
    const data = new Uint8ClampedArray(W * H * 4);
    paintLightmap(data, W, H, AMBIENT, [light]);
    expect(pixel(data, W, 0, 0)).toBe(AMBIENT);
  });

  it('takes the brightest channel where lights overlap', () => {
    const data = new Uint8ClampedArray(3 * 1 * 4);
    paintLightmap(data, 3, 1, 0, [
      { x: 1.5, y: 0.5, radius: 4, color: 0xff0000 },
      { x: 1.5, y: 0.5, radius: 4, color: 0x00ff00 },
    ]);
    expect(pixel(data, 3, 1, 0)).toBe(0xffff00);
  });
});
