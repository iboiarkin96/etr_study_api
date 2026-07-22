import { useEffect } from 'react';

import { Providers } from './app/providers';

export function App() {
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
  }, []);

  return <Providers />;
}
