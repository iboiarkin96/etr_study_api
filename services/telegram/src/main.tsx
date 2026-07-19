import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import { installTelegramMock } from './app/mock-telegram-env';
import { initI18n } from './shared/i18n';
import './styles/global.css';
// Ember design system — tokens + primitives, product-owned. The full ui-kit
// (~4800 lines including showcase chrome + variants B/C we don't ship) is the
// *spec* at services/frontend/portal/assets_v2/ui-kit/components/tma-kit.css.
import './styles/index.css';

// Install the Telegram SDK shim before React mounts so ThemeProvider +
// ViewportProvider can read `window.Telegram.WebApp` synchronously on their
// first render. Idempotent; no-op inside real Telegram.
installTelegramMock();

// i18n boots at English; AuthProvider swaps to the user's `language_code`
// once the handshake resolves (see auth-provider.tsx).
initI18n();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
