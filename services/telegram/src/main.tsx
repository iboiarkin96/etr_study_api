import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { installTelegramMock } from './app/mock-telegram-env';
import './styles/global.css';

// Install the Telegram SDK shim before React mounts so ThemeProvider +
// ViewportProvider can read `window.Telegram.WebApp` synchronously on their
// first render. Idempotent; no-op inside real Telegram.
installTelegramMock();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
