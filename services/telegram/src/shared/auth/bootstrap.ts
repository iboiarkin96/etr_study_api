/**
 * Cold-open auth handshake for the Telegram Mini App.
 *
 * Sequence:
 *
 *   1. Try the JWT + user profile already cached in `WebApp.CloudStorage`.
 *      If both are present and the JWT is still valid (5-min safety margin
 *      before `exp`), we are done — no network round-trip on a warm reopen.
 *   2. Otherwise, POST `WebApp.initData` to `/api/v1/auth/telegram`.
 *      In the plain-browser dev loop the SDK's `initData` is empty; fall
 *      back to `VITE_DEV_INIT_DATA` (produced by `tools/dev/sign_init_data.py`).
 *   3. Persist the new JWT AND the user profile into `CloudStorage` so the
 *      next cold open skips the round-trip.
 *
 * The profile must be cached alongside the token: the JWT only carries
 * `sub` (client_uuid), but every `/api/v1/*` call builds its owner params
 * from `user.telegram_user_id`. Rehydrating with a placeholder id used to
 * make every list query ask the server for user «0» (USER_404 → screens
 * looked empty after a page refresh even though the data was saved).
 *
 * The function is idempotent — safe to call twice; the in-flight promise is
 * memoised so React StrictMode's double-invoke does not double-hit
 * `/auth/telegram`.
 */

const JWT_STORAGE_KEY = 'auth.jwt';
const USER_STORAGE_KEY = 'auth.user';
const REFRESH_MARGIN_SECONDS = 5 * 60;

import { cloudGet, cloudRemove, cloudSet } from './cloud-storage';

export type BootstrapedUser = {
  client_uuid: string;
  telegram_user_id: number;
  telegram_username: string | null;
  telegram_photo_url: string | null;
  locale: string | null;
  full_name: string;
};

export type BootstrapResult = {
  jwt: string;
  expiresAtEpoch: number;
  user: BootstrapedUser;
  cached: boolean;
};

function apiBaseUrl(): string {
  // Empty string = relative URL — fetch resolves against the current origin,
  // which the Vite dev-server proxies to the local API. This is the default
  // for the on-device tunnel workflow (one tunnel, one origin, no CORS).
  // Only set VITE_API_BASE_URL if the frontend and API live on different
  // origins (e.g. Cloudflare Pages front + separately-hosted API in prod).
  const explicit = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!explicit) return '';
  return explicit.replace(/\/+$/, '');
}

/** Extract the initData string to sign against `/auth/telegram`. */
function readInitData(): string {
  const real = window.Telegram?.WebApp?.initData ?? '';
  if (real.length > 0) return real;
  const dev = import.meta.env.VITE_DEV_INIT_DATA as string | undefined;
  return dev ?? '';
}

/** Numeric Telegram user id from the SDK's `initDataUnsafe`. Returns 0
 * when unavailable (dev-fallback loop or shim). Used to detect a stale
 * CloudStorage cache when the current Telegram session belongs to a
 * different account than the one the token was minted for. */
function readInitDataUserId(): number {
  const wa = window.Telegram?.WebApp as
    | { initDataUnsafe?: { user?: { id?: number } } }
    | undefined;
  const id = wa?.initDataUnsafe?.user?.id;
  return typeof id === 'number' && id > 0 ? id : 0;
}

/** Decode a JWT payload without verifying (verify happens on the server). */
function decodeExpiry(jwt: string): number | null {
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const padded = parts[1].padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), '=');
    const json = atob(padded.replaceAll('-', '+').replaceAll('_', '/'));
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

async function readCachedJwt(): Promise<string | null> {
  const cached = await cloudGet(JWT_STORAGE_KEY);
  if (!cached) return null;
  const exp = decodeExpiry(cached);
  const nowEpoch = Math.floor(Date.now() / 1000);
  if (exp === null || exp - nowEpoch < REFRESH_MARGIN_SECONDS) {
    await cloudRemove(JWT_STORAGE_KEY);
    return null;
  }
  return cached;
}

async function exchangeInitData(initData: string): Promise<BootstrapResult> {
  const response = await fetch(`${apiBaseUrl()}/api/v1/auth/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ init_data: initData }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `auth/telegram failed: HTTP ${response.status}${body ? ` — ${body}` : ''}`,
    );
  }
  const parsed = (await response.json()) as {
    jwt: string;
    expires_at_epoch: number;
    user: BootstrapedUser;
  };
  await cloudSet(JWT_STORAGE_KEY, parsed.jwt);
  await cloudSet(USER_STORAGE_KEY, JSON.stringify(parsed.user));
  return {
    jwt: parsed.jwt,
    expiresAtEpoch: parsed.expires_at_epoch,
    user: parsed.user,
    cached: false,
  };
}

/** Decode the `sub` claim (client_uuid) without verifying. */
function decodeSub(jwt: string): string | null {
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const padded = parts[1].padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), '=');
    const json = atob(padded.replaceAll('-', '+').replaceAll('_', '/'));
    const payload = JSON.parse(json) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/**
 * Rehydrate the profile cached alongside a still-valid JWT. Returns null —
 * forcing a fresh initData exchange — when the profile is missing, corrupt,
 * carries no usable telegram_user_id, or belongs to a different account
 * than the token's `sub` (a second Telegram account on the same device).
 */
async function readCachedUser(jwt: string): Promise<BootstrapedUser | null> {
  const raw = await cloudGet(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as BootstrapedUser;
    if (typeof user.telegram_user_id !== 'number' || user.telegram_user_id <= 0) return null;
    if (!user.client_uuid || user.client_uuid !== decodeSub(jwt)) return null;
    return user;
  } catch {
    return null;
  }
}

let pending: Promise<BootstrapResult> | null = null;

export function bootstrapAuth(): Promise<BootstrapResult> {
  if (pending) return pending;
  pending = (async () => {
    const cached = await readCachedJwt();
    if (cached) {
      const user = await readCachedUser(cached);
      // Reject the cache when the current Telegram session belongs to a
      // different account than the token was minted for. Without this
      // guard, switching accounts (or graduating from VITE_DEV_INIT_DATA
      // to a real Telegram session) silently hands the new user the old
      // user's JWT — every /me/* query then resolves to a stranger's owner
      // row and Today either hangs on «Connecting to the server…» or
      // renders someone else's data.
      const currentSessionUserId = readInitDataUserId();
      const cacheBelongsToOtherUser =
        user !== null &&
        currentSessionUserId > 0 &&
        user.telegram_user_id !== currentSessionUserId;
      if (cacheBelongsToOtherUser) {
        await cloudRemove(JWT_STORAGE_KEY);
        await cloudRemove(USER_STORAGE_KEY);
      } else if (user) {
        const exp = decodeExpiry(cached) ?? 0;
        return { jwt: cached, expiresAtEpoch: exp, user, cached: true };
      }
    }
    const initData = readInitData();
    if (!initData) {
      throw new Error(
        'No initData available. Real Telegram provides it automatically; in dev, ' +
          'set VITE_DEV_INIT_DATA (see tools/dev/sign_init_data.py).',
      );
    }
    return exchangeInitData(initData);
  })();
  pending.catch(() => {
    // Reset on failure so the caller can retry.
    pending = null;
  });
  return pending;
}

/** Testing / logout only — clears the cache and the in-flight promise. */
export async function resetAuthForTests(): Promise<void> {
  pending = null;
  await cloudRemove(JWT_STORAGE_KEY);
  await cloudRemove(USER_STORAGE_KEY);
}
