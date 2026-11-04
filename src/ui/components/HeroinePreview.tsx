import { useEffect, useRef } from 'react';

import { buildSwapTable, recolorPixels, type Appearance, type HeroinePalettes } from '@/game/assets/recolor';

import { assetUrl } from './common';

let sheetPromise: Promise<{ img: HTMLImageElement; palettes: HeroinePalettes }> | null = null;

function loadSheet() {
  sheetPromise ??= Promise.all([
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = assetUrl('heroine');
    }),
    fetch(assetUrl('heroine-palettes')).then((r) => r.json() as Promise<HeroinePalettes>),
  ]).then(([img, palettes]) => ({ img, palettes }));
  return sheetPromise;
}

const FRAME_W = 16;
const FRAME_H = 32;

/**
 * The heroine with the chosen colors, recolored exactly as in the world.
 * Walks in place facing down (4 frames) so the walk cycle is visible too.
 */
export function HeroinePreview({ appearance, scale = 4 }: { appearance: Appearance; scale?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let frame = 0;
    let timer = 0;
    let cancelled = false;
    void loadSheet().then(({ img, palettes }) => {
      if (cancelled || !canvas.current) return;
      const work = document.createElement('canvas');
      work.width = FRAME_W * 4;
      work.height = FRAME_H;
      const wctx = work.getContext('2d')!;
      wctx.drawImage(img, 0, 0, FRAME_W * 4, FRAME_H, 0, 0, FRAME_W * 4, FRAME_H);
      const data = wctx.getImageData(0, 0, work.width, work.height);
      recolorPixels(data.data, buildSwapTable(palettes, appearance));
      wctx.putImageData(data, 0, 0);
      const ctx = canvas.current.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      const draw = () => {
        ctx.clearRect(0, 0, FRAME_W * scale, FRAME_H * scale);
        ctx.drawImage(work, frame * FRAME_W, 0, FRAME_W, FRAME_H, 0, 0, FRAME_W * scale, FRAME_H * scale);
        frame = (frame + 1) % 4;
      };
      draw();
      timer = window.setInterval(draw, 160);
    });
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [appearance, scale]);

  return <canvas ref={canvas} className="heroine-preview" width={FRAME_W * scale} height={FRAME_H * scale} aria-hidden />;
}
