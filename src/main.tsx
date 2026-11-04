import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@ds/tokens.css';
import '@ds/components/bundle.css';
import './styles/app.css';

import './i18n';
import { startGame } from './game';
import { getGameStore } from './state/store';
import { App } from './ui/App';

startGame(document.getElementById('game')!);

// Load the saved game (IndexedDB) as early as possible; screens read it in stage 4.
void getGameStore().then(async (store) => {
  await store.getState().init();
  if (import.meta.env.DEV) (window as unknown as { __store: typeof store }).__store = store;
});

createRoot(document.getElementById('ui')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
