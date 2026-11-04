import Phaser from 'phaser';

import { ASSETS, type Asset } from './manifest';

function queue(scene: Phaser.Scene, key: string, asset: Asset, url = asset.url): void {
  switch (asset.kind) {
    case 'image':
      scene.load.image(key, url);
      break;
    case 'spritesheet':
      scene.load.spritesheet(key, url, {
        frameWidth: asset.frameWidth,
        frameHeight: asset.frameHeight,
        spacing: asset.spacing ?? 0,
      });
      break;
    case 'json':
      scene.load.json(key, url);
      break;
    case 'tilemap':
      scene.load.tilemapTiledJSON(key, url);
      break;
  }
}

/**
 * Queue every manifest asset. If a primary file fails to load and the asset has
 * a design-system fallback, the fallback is queued under the same key.
 */
export function preloadAll(scene: Phaser.Scene): void {
  const retried = new Set<string>();
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
    const asset = ASSETS[file.key];
    if (!asset || asset.kind === 'json' || asset.kind === 'tilemap' || !asset.fallback || retried.has(file.key)) return;
    retried.add(file.key);
    console.warn(`[assets] ${file.key}: primary missing, using design-system fallback`);
    queue(scene, file.key, asset, asset.fallback);
  });
  for (const [key, asset] of Object.entries(ASSETS)) queue(scene, key, asset);
}
