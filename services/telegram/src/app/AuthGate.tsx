/**
 * AuthGate — single point of authority for the two states every screen
 * used to inline-render: «auth still handshaking» and «auth failed».
 *
 *   * `idle` / `authenticating` → <BootScreen /> (warm splash, 200 ms fade)
 *   * `error`                    → <ErrorScreen /> (mapped to the right
 *                                    unreachable / denied / catch-all copy)
 *   * `authenticated`            → children (the actual app tree)
 *
 * Before this gate, five screens each carried their own «Connecting to
 * the server…» plate and their own auth-error branch — duplicated copy,
 * duplicated markup, drifted whenever one screen changed and the others
 * didn't. Centralising both here keeps the callsites focused on their
 * business logic and gives us one place to redesign the boot/error look.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { BootScreen } from '../screens/Boot';
import { ErrorScreen } from '../screens/Today/components/ErrorScreen';
import { useAuth } from './use-auth';

type ErrorNamespace = 'auth.unreachable' | 'auth.denied' | 'auth.error';

function classifyAuthError(message: string): ErrorNamespace {
  if (/failed to fetch|networkerror|network error|fetch failed/i.test(message)) {
    return 'auth.unreachable';
  }
  if (/401|unauthori[sz]ed|token|jwt|signature/i.test(message)) {
    return 'auth.denied';
  }
  return 'auth.error';
}

export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { t } = useTranslation();

  if (auth.status === 'idle' || auth.status === 'authenticating') {
    return <BootScreen />;
  }

  if (auth.status === 'error') {
    const ns = classifyAuthError(auth.error?.message ?? '');
    return (
      <main
        className="tma-scope"
        data-density="regular"
        style={{
          minHeight: 'var(--tma-viewport-h, 100dvh)',
          background: 'var(--tma-surface-canvas)',
          color: 'var(--tma-text-primary)',
        }}
      >
        <ErrorScreen
          title={t(`${ns}.title`)}
          body={t(`${ns}.body`)}
          ctaLabel={t(`${ns}.cta`)}
          onRetry={() => auth.retry()}
        />
      </main>
    );
  }

  return <>{children}</>;
}
