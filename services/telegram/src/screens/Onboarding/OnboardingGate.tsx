/**
 * OnboardingGate — first-run redirector.
 *
 * Wraps Today: while `useOnboardingSeen()` is hydrating (`unknown`) the gate
 * renders nothing, so the first frame is never the wrong screen. If the flag
 * is missing (`unseen`) it redirects to `/onboarding` in an effect (Router
 * navigate must not fire during render). Once seen, Today renders inline.
 *
 * The gate lives on `/` only — the Onboarding screen itself calls `markSeen`
 * and then navigates to `/`, at which point the gate resolves to `'seen'`
 * and renders the app. Bookmarks / deep links to any other route bypass the
 * gate — that is intentional, they carry their own routing intent.
 */

import { useNavigate } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';

import { useOnboardingSeen } from './hooks/useOnboardingSeen';

export function OnboardingGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { state } = useOnboardingSeen();

  useEffect(() => {
    if (state === 'unseen') {
      void navigate({ to: '/onboarding', replace: true });
    }
  }, [state, navigate]);

  if (state !== 'seen') return null;
  return <>{children}</>;
}
