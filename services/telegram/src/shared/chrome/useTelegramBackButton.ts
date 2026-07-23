/**
 * Declarative wrapper over `WebApp.BackButton` (T-25d).
 *
 * Turns the imperative Telegram SDK — `show()` / `hide()` / `onClick(cb)` /
 * `offClick(cb)` — into a React-idiomatic hook. Pass a handler while the
 * component wants the button visible; pass `null` (or unmount) to hide it.
 * Callback identity is stashed in a ref so re-renders don't reinstall the
 * SDK listener (which would leak subscriptions and race against `offClick`).
 *
 * Safe outside real Telegram: falls back to a no-op if `window.Telegram`
 * or the button subobject is missing — the same shape the plain-browser
 * dev shim installs, and the same shape unit tests can stub.
 */

import { useEffect, useRef } from 'react';

type WebAppButton = {
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
};

function readBackButton(): WebAppButton | null {
  const wa = (window as { Telegram?: { WebApp?: { BackButton?: WebAppButton } } })
    .Telegram?.WebApp?.BackButton;
  return wa ?? null;
}

export function useTelegramBackButton(handler: (() => void) | null): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // Depend only on presence/absence — updating the handler's body doesn't
  // need to churn the SDK listener because we route through the ref.
  const active = handler !== null;

  useEffect(() => {
    const btn = readBackButton();
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
