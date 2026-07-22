/**
 * True when the app is running inside a real Telegram WebView — i.e. the
 * host has injected a non-empty `WebApp.initData`. False in the plain-
 * browser dev loop (our mock env leaves `initData` as `''`) and in
 * Storybook / vitest where nothing installs `window.Telegram` at all.
 *
 * Used to switch off on-canvas primary CTAs and header back links when
 * Telegram is drawing the equivalent native controls (MainButton /
 * BackButton) — so the user doesn't see two buttons that do the same
 * thing. The on-canvas versions stay for the dev loop, older Telegram
 * builds that lack a control, and Storybook — see
 * `reference/components/telegram-chrome.html` for the policy.
 *
 * The value is stable per mount — Telegram doesn't hand `initData` back
 * after boot, so re-checking on every render would just add noise.
 */

import { useState } from 'react';

function readIsTelegramClient(): boolean {
  if (typeof window === 'undefined') return false;
  const wa = (window as { Telegram?: { WebApp?: { initData?: string } } })
    .Telegram?.WebApp;
  if (!wa) return false;
  return typeof wa.initData === 'string' && wa.initData.length > 0;
}

export function useIsTelegramClient(): boolean {
  const [isReal] = useState(readIsTelegramClient);
  return isReal;
}
