import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@ds/tokens.css';
import '@ds/components/bundle.css';
import './styles/app.css';

import './i18n';
import { startGame } from './game';
import { App } from './ui/App';

startGame(document.getElementById('game')!);

createRoot(document.getElementById('ui')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
