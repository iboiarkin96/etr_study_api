/**
 * Declarative wrapper over `WebApp.SettingsButton` (T-25d).
 *
 * Same lifecycle contract as the BackButton hook — pass a handler while
 * visible, pass `null` (or unmount) to hide it. On iOS Telegram this is
 * the gear icon that appears in the sheet header next to Close; a common
 * use is to navigate to a profile / preferences screen. Falls back to a
 * no-op when the SDK isn't present so tests can still render.
 */

import { useEffect, useRef } from 'react';

type WebAppButton = {
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
};

function readSettingsButton(): WebAppButton | null {
  const wa = (window as { Telegram?: { WebApp?: { SettingsButton?: WebAppButton } } })
    .Telegram?.WebApp?.SettingsButton;
  return wa ?? null;
}

export function useTelegramSettingsButton(handler: (() => void) | null): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const active = handler !== null;

  useEffect(() => {
    const btn = readSettingsButton();
    if (!btn) return;
    const listener = () => handlerRef.current?.();
    if (active) {
      btn.onClick(listener);
      btn.show();
      return () => {
        btn.offClick(listener);
        btn.hide();
      };
    }
    btn.hide();
    return () => {};
  }, [active]);
}
