/**
 * PostHog integration — env-guarded. `VITE_POSTHOG_KEY` toggles the whole
 * layer; if unset, `initPostHog()` is a no-op and `track()` / `identify()`
 * / `reset()` become dead code that ships zero network cost.
 *
 * Identity handling follows the event-spec (`reference/event-spec.html`):
 *   * PostHog auto-generates an anonymous `distinct_id` for the visitor
 *     on load; `app_opened` and any pre-bootstrap events attach to it.
 *   * After `POST /auth/telegram` returns the JWT, `AuthProvider` calls
 *     `identify(user.client_uuid, {locale: user.locale})`. PostHog aliases
 *     the anonymous session into the identified one — the pre-bootstrap
 *     `app_opened` row now attributes to the real user in dashboards.
 *
 * We NEVER send `telegram_user_id`, `telegram_username`, or `first_name`
 * as a property or as `distinct_id`. Telegram-side identifiers stay
 * server-side; PostHog only ever sees the internal UUID.
 */

import posthog from 'posthog-js';

let enabled = false;

export function initPostHog(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) return;

  posthog.init(key, {
    api_host: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://eu.i.posthog.com',
    // We call identify() ourselves after bootstrap; don't auto-guess.
    person_profiles: 'identified_only',
    // Autocapture off — event-spec is a fixed vocabulary; we don't want
    // random click/scroll events polluting the analytics stream.
    autocapture: false,
    // Session recording off — privacy + quota; PostHog stays events-only
    // until we have a documented need.
    disable_session_recording: true,
    // Capture pageviews from the router explicitly, not from location.
    capture_pageview: false,
    loaded: (ph) => {
      if (import.meta.env.MODE !== 'production') {
        ph.debug();
      }
    },
  });

  enabled = true;
}

/** Assign the current PostHog session to a stable user id after auth
 * handshake succeeds. Merges the anonymous pre-bootstrap session into
 * the identified one. */
export function identify(distinctId: string, properties?: Record<string, unknown>): void {
  if (!enabled) return;
  posthog.identify(distinctId, properties);
}

/** Clear the identity — call on sign-out. Prevents the next user on the
 * same device from inheriting the previous user's timeline. */
export function reset(): void {
  if (!enabled) return;
  posthog.reset();
}

/** Fire a typed event. Prefer the typed emitters in `events.ts` over
 * calling this directly — they enforce the property vocabulary from
 * `reference/event-spec.html`. */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (!enabled) {
    if (import.meta.env.MODE !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[observability] track (no-op):', event, properties ?? {});
    }
    return;
  }
  posthog.capture(event, properties);
}
