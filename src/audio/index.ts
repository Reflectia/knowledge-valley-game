import type { StoreApi } from 'zustand/vanilla';

import type { GameState } from '@/state/store';

import { AudioEngine, type Sfx } from './engine';

export type { Sfx } from './engine';

/** The one audio engine of the page. */
export const audio = new AudioEngine();

/** Music per map: the house shares the homestead's track. */
const MUSIC: Record<string, string> = {
  homestead: 'homestead',
  house: 'homestead',
  forest: 'forest',
  tower: 'tower',
  market: 'market',
  forge: 'forge',
  library: 'library',
};

let place: string | null = null;
let inGame = false;

function updateMusic(): void {
  // Menus (start, character creation) play the homestead theme.
  audio.playMusic(inGame ? (place ? (MUSIC[place] ?? null) : null) : 'homestead');
  if (!inGame) audio.setNight(0);
}

/** The world scene entered a map. */
export function setPlace(mapId: string): void {
  place = mapId;
  updateMusic();
}

/** The UI switched between menus and the game. */
export function setInGame(on: boolean): void {
  inGame = on;
  updateMusic();
}

/** 0..1, from the clock: the night version of the track fades in. */
export function setNight(n: number): void {
  if (inGame) audio.setNight(n);
}

export function sfx(name: Sfx): void {
  audio.play(name);
}

/** Keep the volumes in sync with the settings. */
export function connectAudio(store: StoreApi<GameState>): () => void {
  audio.setVolume(store.getState().labs.settings.volume);
  audio.preload(['step-0', 'step-1', 'step-2', 'step-3', 'step-4', 'harvest', 'water', 'till', 'swing', 'enemy-hit', 'hurt']);
  return store.subscribe((s, prev) => {
    if (s.labs.settings.volume !== prev.labs.settings.volume) audio.setVolume(s.labs.settings.volume);
  });
}
