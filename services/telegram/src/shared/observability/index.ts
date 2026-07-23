/**
 * Barrel — the ONE import path call-sites reach for observability. Keeps
 * Sentry / PostHog transport details out of feature code:
 *
 *   import {
 *     initObservability,
 *     captureError,
 *     identifyUser,
 *     trackReviewCompleted,
 *   } from '../shared/observability';
 */

export { captureError, initSentry } from './sentry';
export { identify as identifyUser, initPostHog, reset as resetIdentity, track } from './posthog';
export * from './events';

import { initPostHog } from './posthog';
import { initSentry } from './sentry';

/** Convenience for `main.tsx` — brings both transports up in one call. */
export function initObservability(): void {
  initSentry();
  initPostHog();
}
