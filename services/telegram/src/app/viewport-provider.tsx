/**
 * ViewportProvider — writes viewport height + safe-area insets from the
 * Telegram SDK onto <html> as CSS custom properties:
 *
 *   --tma-viewport-h   — current viewport height in px
 *   --tma-safe-top     — safe-area inset top (notch)
 *   --tma-safe-bottom  — safe-area inset bottom (home indicator)
 *   --tma-safe-left    — safe-area inset left
 *   --tma-safe-right   — safe-area inset right
 *
 * Screens read these as `calc(var(--tma-viewport-h) - var(--tma-safe-top))`
 * for full-height layouts and `padding-bottom: var(--tma-safe-bottom)` for
 * bottom-anchored controls.
 *
 * Live-reactive: subscribes to Telegram's `viewportChanged` event; falls back
 * to `window.resize` when the WebApp shim doesn't fire it (plain browser dev
 * loop).
 */

import { useEffect, type ReactNode } from 'react';

type Snapshot = {
  height: number;
  insets: { top: number; bottom: number; left: number; right: number };
};

function readViewport(): Snapshot {
  const wa = window.Telegram?.WebApp;
  const height = wa?.viewportStableHeight ?? wa?.viewportHeight ?? window.innerHeight;
  const insets = wa?.safeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 };
  return { height, insets };
}

function applyViewportToRoot(snapshot: Snapshot): void {
  const root = document.documentElement;
  root.style.setProperty('--tma-viewport-h', `${snapshot.height}px`);
  root.style.setProperty('--tma-safe-top', `${snapshot.insets.top}px`);
  root.style.setProperty('--tma-safe-bottom', `${snapshot.insets.bottom}px`);
  root.style.setProperty('--tma-safe-left', `${snapshot.insets.left}px`);
  root.style.setProperty('--tma-safe-right', `${snapshot.insets.right}px`);
}

type Props = { children: ReactNode };

export function ViewportProvider({ children }: Props) {
  useEffect(() => {
    applyViewportToRoot(readViewport());

    const update = (): void => applyViewportToRoot(readViewport());
    const wa = window.Telegram?.WebApp;
    wa?.onEvent('viewportChanged', update);
    window.addEventListener('resize', update);
    return () => {
      wa?.offEvent('viewportChanged', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return <>{children}</>;
}
