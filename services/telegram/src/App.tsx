import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Providers } from './app/providers';
import { trackAppOpened, type LaunchSource, type TgPlatform } from './shared/observability';

/** Guess launch source from Telegram's start-app param + URL. Server can
 * disambiguate later via analytics dashboards — this is best-effort
 * client-side classification, safe to be a little coarse. */
function detectLaunchSource(): LaunchSource {
  const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
  if (startParam) return 'deep_link';
  // Any real Telegram launch (bot menu button OR direct URL bookmark) has
  // an initData string. Empty initData ⇒ someone opened the dev tunnel in
  // a plain browser tab.
  const initData = window.Telegram?.WebApp?.initData;
  if (initData && initData.length > 0) return 'bot_button';
  return 'direct';
}

function detectPlatform(): TgPlatform {
  const platform = window.Telegram?.WebApp?.platform;
  switch (platform) {
    case 'ios':
    case 'android':
    case 'tdesktop':
    case 'weba':
    case 'macos':
      return platform;
    default:
      return 'unknown';
  }
}

export function App() {
  const { i18n } = useTranslation();

  // Signal to Telegram that the Mini App is mounted and ready to be shown.
  // Called from useEffect (not main.tsx) so the first render has already
  // committed a DOM — this is what the Telegram docs mean by "as soon as
  // the essential interface elements are loaded". On iOS in particular,
  // calling ready() before a rendered frame can leave HapticFeedback in an
  // uninitialised state and every impactOccurred() call silently no-ops.
  // `expand()` is idempotent and safe in the dev shim (no-op).
  useEffect(() => {
    try {
      window.Telegram?.WebApp?.ready?.();
      window.Telegram?.WebApp?.expand?.();
    } catch {
      // Best-effort; a broken shim must not block boot.
    }

    // Fire the session-start event once per mount. Anonymous PostHog
    // session at this point (bootstrap has NOT run yet); AuthProvider
    // aliases it to the real user id via `identifyUser` on success —
    // see reference/event-spec.html § Identity.
    trackAppOpened({
      launch_source: detectLaunchSource(),
      tg_platform: detectPlatform(),
      language: i18n.language === 'ru' ? 'ru' : 'en',
    });
  }, [i18n.language]);

  return <Providers />;
}
