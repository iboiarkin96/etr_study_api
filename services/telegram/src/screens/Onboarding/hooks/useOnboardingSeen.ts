/**
 * First-run flag for the Onboarding screen (T-24).
 *
 * The flag persists in Telegram's `WebApp.CloudStorage` under
 * `onboarding_done` so it survives a device swap (Telegram syncs cloud
 * storage per user). A localStorage mirror is kept so:
 *
 *   1. In-session decisions are instant — the write to CloudStorage is
 *      callback-based and can take a network round-trip; reading back on
 *      the next mount would flash the screen. Local mirror wins the race.
 *   2. Plain-browser dev + Storybook + tests have no Telegram shim yet
 *      still remember the choice across a page reload.
 *
 * States:
 *
 *   'unknown' — hydration in flight (very first mount); render nothing so
 *               we don't flash the wrong surface.
 *   'unseen'  — first run; Today's router gate redirects to /onboarding.
 *   'seen'    — the user has finished (or explicitly skipped) the flow.
 *
 * `markSeen()` writes both mirrors and flips the state; the callback shape
 * lets the screen close its own presence without waiting on the cloud.
 */

import { useCallback, useEffect, useState } from 'react';

import { cloudGet, cloudSet } from '../../../shared/auth/cloud-storage';

const KEY = 'onboarding_done';

export type OnboardingSeenState = 'unknown' | 'unseen' | 'seen';

function readLocal(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function writeLocal() {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    // Private mode / quota — the CloudStorage write is still authoritative.
  }
}

export function useOnboardingSeen() {
  // Lazy initializer reads localStorage on the FIRST render — so a warm
  // reopen after `markSeen()` mounts `OnboardingGate` already in the `'seen'`
  // state and renders Today with no blank frame. Only cold opens with no
  // local mirror enter `'unknown'` and wait on the cloud read.
  const [state, setState] = useState<OnboardingSeenState>(() =>
    readLocal() ? 'seen' : 'unknown',
  );

  useEffect(() => {
    // If the lazy initializer already resolved to `'seen'`, skip the cloud
    // round-trip entirely — the local mirror is authoritative for this
    // session and the cloud write happened when markSeen was called.
    if (state === 'seen') return;
    let cancelled = false;
    cloudGet(KEY).then(
      (value) => {
        if (cancelled) return;
        setState(value === '1' ? 'seen' : 'unseen');
      },
      () => {
        if (cancelled) return;
        setState('unseen');
      },
    );
    return () => {
      cancelled = true;
    };
    // The effect intentionally reads `state` only on first mount to decide
    // whether to hit the cloud — subsequent transitions come from setState
    // and don't need to re-fire the read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markSeen = useCallback(() => {
    writeLocal();
    setState('seen');
    // Fire-and-forget — the local mirror already survives this session; the
    // cloud write covers the next device. A dropped write just re-shows the
    // screen once on the new device — harmless.
    void cloudSet(KEY, '1');
  }, []);

  return { state, markSeen };
}
