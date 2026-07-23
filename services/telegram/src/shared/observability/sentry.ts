/**
 * Sentry integration — env-guarded. If `VITE_SENTRY_DSN` is not set (dev
 * laptops, first-run environments), `initSentry()` is a no-op and every
 * subsequent `captureError()` falls through to `console.error`. This keeps
 * the dev loop console-first and the prod flight recorder wired without
 * either interfering with the other.
 *
 * Wired at two points in the tree:
 *   * `main.tsx` → `initSentry()` before React mounts (so early boot
 *     errors are captured too).
 *   * `AppErrorBoundary.componentDidCatch` + router's
 *     `defaultErrorComponent` → `captureError(error, {componentStack})`
 *     for every render / effect crash.
 *
 * See `internal/services/telegram/reference/observability.html` for the
 * end-to-end story (envs, callsites, privacy, sampling).
 */

import * as Sentry from '@sentry/react';

let enabled = false;

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    // 10% of transactions in prod, 100% in dev (dev has few users; prod
    // has enough traffic that sampling matters for quota).
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    // No session replay for now — PostHog handles product analytics;
    // Sentry stays focused on the error stream.
    environment: import.meta.env.MODE,
    // Release stamped at build-time via VITE_APP_VERSION (CI sets this to
    // the git short-SHA of the build commit); empty in local dev, which
    // Sentry handles fine. Same var also shows in the Profile footer.
    release: (import.meta.env.VITE_APP_VERSION as string | undefined) || undefined,
  });

  enabled = true;
}

type ErrorContext = {
  componentStack?: string | null;
  [key: string]: unknown;
};

export function captureError(error: unknown, context?: ErrorContext): void {
  if (!enabled) {
    // Dev / DSN-absent path — a single-line console.error so the browser
    // groups our tagged prefix with the error's own stack.
    // eslint-disable-next-line no-console
    console.error('[observability] captureError:', error, context ?? '');
    return;
  }

  Sentry.captureException(error, {
    contexts: {
      react: context?.componentStack ? { componentStack: context.componentStack } : undefined,
    },
    extra: context,
  });
}
