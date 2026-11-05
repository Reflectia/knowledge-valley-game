import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@ds/tokens.css';
import '@ds/components/bundle.css';
import './styles/app.css';

import { audio } from './audio';
import './i18n';
import { startGame } from './game';
import { getGameStore } from './state/store';
import { App } from './ui/App';
import { GameProvider } from './ui/GameContext';

void getGameStore().then((store) => {
  // Load the saved game (IndexedDB); the start menu waits for `ready`.
  void store.getState().init();
  startGame(document.getElementById('game')!, store);
  if (import.meta.env.DEV) Object.assign(window, { __store: store, __audio: audio });

  createRoot(document.getElementById('ui')!).render(
    <StrictMode>
      <GameProvider store={store}>
        <App />
      </GameProvider>
    </StrictMode>,
  );
});
