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
 * The flag polls for a real `initData` during the first ~2 s after
 * mount and upgrades to true the moment one appears. This covers three
 * cases the original single-shot read got wrong:
 *
 *   1. Slow injection — some Android WebView builds hand
 *      `window.Telegram.WebApp` back a tick or two after our JS boots.
 *   2. Cached HTML — a Mini App reload that Telegram served from its
 *      own WebKit cache can predate our `<script src=".../telegram-web-app.js">`
 *      injection; the flag would otherwise stick to false forever.
 *   3. First mount before `installTelegramMock()` had a chance to see
 *      the real WebApp object.
 *
 * Once true, the flag stays true — we don't downgrade if the SDK
 * momentarily returns empty. Cheap by construction: the effect only
 * arms timers while `false`, and clears them on mount teardown.
 */

import { useEffect, useState } from 'react';

function readIsTelegramClient(): boolean {
  if (typeof window === 'undefined') return false;
  const wa = (window as { Telegram?: { WebApp?: { initData?: string } } })
    .Telegram?.WebApp;
  if (!wa) return false;
  return typeof wa.initData === 'string' && wa.initData.length > 0;
}

/** Retry delays picked to cover the empirically observed injection
 *  windows: 200 ms handles most Chromium-based hosts, 800 ms covers
 *  older Android WebViews, 2000 ms is the last-chance sweep before we
 *  accept that we really are outside Telegram. */
const RETRY_DELAYS_MS = [200, 800, 2000];

export function useIsTelegramClient(): boolean {
  const [isReal, setIsReal] = useState(readIsTelegramClient);

  useEffect(() => {
    if (isReal) return;
    const timers = RETRY_DELAYS_MS.map((delay) =>
      window.setTimeout(() => {
        if (readIsTelegramClient()) setIsReal(true);
      }, delay),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [isReal]);

  return isReal;
}
