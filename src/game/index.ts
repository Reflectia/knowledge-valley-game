import Phaser from 'phaser';
import type { StoreApi } from 'zustand/vanilla';

import type { GameState } from '@/state/store';

import { TILE_SIZE, worldScaleFor } from './constants';
import { BootScene } from './scenes/BootScene';

let game: Phaser.Game | null = null;

export function startGame(parent: HTMLElement, store: StoreApi<GameState>): Phaser.Game {
  if (game) return game;

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#2e1b12', // wood-900, matches the page background
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    // The world must not steal keys from text fields in the UI.
    input: { keyboard: { target: window } },
    scene: [BootScene],
  });

  game.registry.set('tileSize', TILE_SIZE);
  game.registry.set('worldScale', worldScaleFor(window.innerWidth, window.innerHeight));
  game.registry.set('store', store);

  // While a menu or window is open, the world ignores the keyboard.
  const applyBlocking = (blocking: boolean) => {
    for (const scene of game!.scene.getScenes(true)) {
      if (scene.input.keyboard) {
        scene.input.keyboard.enabled = !blocking;
        if (blocking) scene.input.keyboard.resetKeys();
      }
    }
  };
  store.subscribe((s, prev) => s.uiBlocking !== prev.uiBlocking && applyBlocking(s.uiBlocking));
  game.events.once(Phaser.Core.Events.READY, () => applyBlocking(store.getState().uiBlocking));

  // Dev-only handle for automated checks (scripts/dev/drive.mjs).
  if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;

  return game;
}
