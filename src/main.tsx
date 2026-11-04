import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@ds/tokens.css';
import '@ds/components/bundle.css';
import './styles/app.css';

import './i18n';
import { startGame } from './game';
import { getGameStore } from './state/store';
import { App } from './ui/App';
import { GameProvider } from './ui/GameContext';

startGame(document.getElementById('game')!);

void getGameStore().then((store) => {
  // Load the saved game (IndexedDB); screens wait for `ready`.
  void store.getState().init();
  if (import.meta.env.DEV) (window as unknown as { __store: typeof store }).__store = store;

  createRoot(document.getElementById('ui')!).render(
    <StrictMode>
      <GameProvider store={store}>
        <App />
      </GameProvider>
    </StrictMode>,
  );
});
