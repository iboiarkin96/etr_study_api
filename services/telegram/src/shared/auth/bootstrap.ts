/**
 * Cold-open auth handshake for the Telegram Mini App.
 *
 * Sequence:
 *
 *   1. Try the JWT already cached in `WebApp.CloudStorage`. If present and
 *      still valid (5-min safety margin before `exp`), we are done — no
 *      network round-trip on a warm reopen.
 *   2. Otherwise, POST `WebApp.initData` to `/api/v1/auth/telegram`.
 *      In the plain-browser dev loop the SDK's `initData` is empty; fall
 *      back to `VITE_DEV_INIT_DATA` (produced by `tools/dev/sign_init_data.py`).
 *   3. Persist the new JWT into `CloudStorage` so the next cold open skips
 *      the round-trip; keep the same value in memory for the current session.
 *
 * The function is idempotent — safe to call twice; the in-flight promise is
 * memoised so React StrictMode's double-invoke does not double-hit
 * `/auth/telegram`.
 */

const JWT_STORAGE_KEY = 'auth.jwt';
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
  const explicit = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return (explicit ?? 'http://localhost:8000').replace(/\/+$/, '');
}

/** Extract the initData string to sign against `/auth/telegram`. */
function readInitData(): string {
  const real = window.Telegram?.WebApp?.initData ?? '';
  if (real.length > 0) return real;
  const dev = import.meta.env.VITE_DEV_INIT_DATA as string | undefined;
  return dev ?? '';
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
  return {
    jwt: parsed.jwt,
    expiresAtEpoch: parsed.expires_at_epoch,
    user: parsed.user,
    cached: false,
  };
}

/**
 * Rehydrate the cached user from a still-valid JWT. Skipped when the
 * bootstrap has to hit the wire — that path already carries the user block.
 */
async function fetchMe(jwt: string): Promise<BootstrapedUser | null> {
  // Placeholder — a dedicated `/api/v1/auth/me` endpoint lands with T-17+.
  // Until then the cached JWT gets treated as authoritative for the sub
  // claim (client_uuid), and the rest of the profile is refreshed the next
  // time we exchange initData for a fresh token.
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const padded = parts[1].padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), '=');
    const json = atob(padded.replaceAll('-', '+').replaceAll('_', '/'));
    const payload = JSON.parse(json) as { sub?: string };
    if (!payload.sub) return null;
    return {
      client_uuid: payload.sub,
      telegram_user_id: 0,
      telegram_username: null,
      telegram_photo_url: null,
      locale: null,
      full_name: '',
    };
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
      const user = await fetchMe(cached);
      if (user) {
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
}
