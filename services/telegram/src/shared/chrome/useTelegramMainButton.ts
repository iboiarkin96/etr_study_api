/**
 * Declarative wrapper over `WebApp.MainButton` (T-25d).
 *
 * Pass a config `{ text, onClick }` to display the native bottom button
 * on the current screen; pass `null` (or unmount) to hide it. The SDK's
 * `setText` is called only when `text` changes so we don't flash the
 * label on unrelated re-renders. Handler is stashed in a ref so the SDK
 * listener stays installed across parent renders.
 *
 * The wrapper deliberately covers just the two knobs every screen needs
 * today — text and click. Colour / enabled / progress land only when a
 * caller has a documented need; keeping the API narrow means it's still
 * obvious what the callsite is actually doing.
 */

import { useEffect, useRef } from 'react';

type MainButton = {
  show: () => void;
  hide: () => void;
  setText: (text: string) => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
};

function readMainButton(): MainButton | null {
  const wa = (window as { Telegram?: { WebApp?: { MainButton?: MainButton } } })
    .Telegram?.WebApp?.MainButton;
  return wa ?? null;
}

export type TelegramMainButtonConfig = {
  text: string;
  onClick: () => void;
};

export function useTelegramMainButton(config: TelegramMainButtonConfig | null): void {
  const onClickRef = useRef(config?.onClick ?? null);
  onClickRef.current = config?.onClick ?? null;

  const active = config !== null;
  const text = config?.text ?? '';

  useEffect(() => {
    const btn = readMainButton();
    if (!btn) return;
    const listener = () => onClickRef.current?.();
    if (active) {
      btn.setText(text);
      btn.onClick(listener);
      btn.show();
      return () => {
        btn.offClick(listener);
        btn.hide();
      };
    }
    btn.hide();
    return () => {};
  }, [active, text]);
}
