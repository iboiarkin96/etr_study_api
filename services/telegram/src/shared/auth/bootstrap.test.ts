/**
 * Unit tests for the auth bootstrap.
 *
 * Pins the T-12 exit criteria:
 *   • `POST /api/v1/auth/telegram` fires exactly once per cold open
 *   • A cached, still-valid JWT skips the round-trip
 *   • The dev-only `VITE_DEV_INIT_DATA` env var is picked up when the
 *     SDK's `initData` is empty (plain-browser dev loop)
 *   • Failure clears the in-flight promise so the next call can retry
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { bootstrapAuth, resetAuthForTests } from './bootstrap';

type MockFetch = ReturnType<typeof vi.fn>;

const SECRET_KEY = 'auth.jwt';

function b64url(input: string): string {
  return btoa(input).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/** Build a JWT with a given `exp` (unix seconds). Signature is a fixed stub. */
function fakeJwt(exp: number, sub = 'client-uuid-1'): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ sub, exp, iat: exp - 3600 }));
  return `${header}.${payload}.stub-signature`;
}

function installMockWebApp(initData: string): void {
  const store = new Map<string, string>();
  window.Telegram = {
    WebApp: {
      version: '7.0',
      platform: 'weba',
      colorScheme: 'light',
      themeParams: {},
      isExpanded: true,
      viewportHeight: 800,
      viewportStableHeight: 800,
      safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
      initData,
      initDataUnsafe: {},
      ready: () => {},
      expand: () => {},
      close: () => {},
      onEvent: () => {},
      offEvent: () => {},
      BackButton: {
        isVisible: false,
        show: () => {},
        hide: () => {},
        onClick: () => {},
        offClick: () => {},
      },
      MainButton: {
        isVisible: false,
        show: () => {},
        hide: () => {},
        onClick: () => {},
        offClick: () => {},
        setText: () => {},
      },
      SettingsButton: {
        isVisible: false,
        show: () => {},
        hide: () => {},
        onClick: () => {},
        offClick: () => {},
      },
      HapticFeedback: {
        impactOccurred: () => {},
        notificationOccurred: () => {},
        selectionChanged: () => {},
      },
      CloudStorage: {
        setItem: (key, value, cb) => {
          store.set(key, value);
          cb?.(null);
        },
        getItem: (key, cb) => cb(null, store.get(key) ?? null),
        getKeys: (cb) => cb(null, [...store.keys()]),
        removeItem: (key, cb) => {
          store.delete(key);
          cb?.(null);
        },
      },
      // Expose the underlying map so tests can prime the cache.
      _store: store,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

function mockFetchResponse(body: object, status = 200): MockFetch {
  return vi.fn(async () =>
    Promise.resolve({
      ok: status < 400,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response),
  );
}

beforeEach(async () => {
  await resetAuthForTests();
  installMockWebApp('user=%7B%22id%22%3A42%7D&auth_date=1&hash=x');
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
});

describe('bootstrapAuth', () => {
  test('POSTs initData exactly once per cold open', async () => {
    const fetchMock = mockFetchResponse({
      jwt: fakeJwt(Math.floor(Date.now() / 1000) + 3600),
      expires_at_epoch: Math.floor(Date.now() / 1000) + 3600,
      user: {
        client_uuid: 'client-uuid-1',
        telegram_user_id: 42,
        telegram_username: 'ada',
        telegram_photo_url: null,
        locale: 'en',
        full_name: 'Ada',
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const [first, second] = await Promise.all([bootstrapAuth(), bootstrapAuth()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.jwt).toBe(second.jwt);
    expect(first.cached).toBe(false);
    expect(first.user.client_uuid).toBe('client-uuid-1');
  });

  test('reuses a cached, still-valid JWT + profile from CloudStorage', async () => {
    const stillValid = fakeJwt(Math.floor(Date.now() / 1000) + 3600, 'cached-uuid');
    const store = (window.Telegram!.WebApp as unknown as { _store: Map<string, string> })._store;
    store.set(SECRET_KEY, stillValid);
    store.set(
      'auth.user',
      JSON.stringify({
        client_uuid: 'cached-uuid',
        telegram_user_id: 42,
        telegram_username: 'ada',
        telegram_photo_url: null,
        locale: 'en',
        full_name: 'Ada',
      }),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await bootstrapAuth();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.jwt).toBe(stillValid);
    expect(result.cached).toBe(true);
    expect(result.user.client_uuid).toBe('cached-uuid');
    // The rehydrated profile must carry the REAL telegram id — owner params
    // for every /api/v1/* call are built from it. A placeholder «0» here
    // made all list queries 404 after a page refresh.
    expect(result.user.telegram_user_id).toBe(42);
  });

  test('re-exchanges initData when the JWT is cached but the profile is missing', async () => {
    const stillValid = fakeJwt(Math.floor(Date.now() / 1000) + 3600, 'cached-uuid');
    (window.Telegram!.WebApp as unknown as { _store: Map<string, string> })._store.set(
      SECRET_KEY,
      stillValid,
    );
    const fetchMock = mockFetchResponse({
      jwt: fakeJwt(Math.floor(Date.now() / 1000) + 3600, 'cached-uuid'),
      expires_at_epoch: Math.floor(Date.now() / 1000) + 3600,
      user: {
        client_uuid: 'cached-uuid',
        telegram_user_id: 42,
        telegram_username: null,
        telegram_photo_url: null,
        locale: null,
        full_name: 'Ada',
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await bootstrapAuth();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.cached).toBe(false);
    expect(result.user.telegram_user_id).toBe(42);
  });

  test('ignores a cached profile that belongs to a different account', async () => {
    const stillValid = fakeJwt(Math.floor(Date.now() / 1000) + 3600, 'account-B');
    const store = (window.Telegram!.WebApp as unknown as { _store: Map<string, string> })._store;
    store.set(SECRET_KEY, stillValid);
    store.set(
      'auth.user',
      JSON.stringify({
        client_uuid: 'account-A',
        telegram_user_id: 7,
        telegram_username: null,
        telegram_photo_url: null,
        locale: null,
        full_name: 'Old Account',
      }),
    );
    const fetchMock = mockFetchResponse({
      jwt: fakeJwt(Math.floor(Date.now() / 1000) + 3600, 'account-B'),
      expires_at_epoch: Math.floor(Date.now() / 1000) + 3600,
      user: {
        client_uuid: 'account-B',
        telegram_user_id: 42,
        telegram_username: null,
        telegram_photo_url: null,
        locale: null,
        full_name: 'Ada',
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await bootstrapAuth();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.user.client_uuid).toBe('account-B');
    expect(result.user.telegram_user_id).toBe(42);
  });

  test('exchanges again when the cached JWT is inside the 5-min refresh margin', async () => {
    const almostExpired = fakeJwt(Math.floor(Date.now() / 1000) + 60);
    (window.Telegram!.WebApp as unknown as { _store: Map<string, string> })._store.set(
      SECRET_KEY,
      almostExpired,
    );
    const fetchMock = mockFetchResponse({
      jwt: fakeJwt(Math.floor(Date.now() / 1000) + 3600, 'client-uuid-1'),
      expires_at_epoch: Math.floor(Date.now() / 1000) + 3600,
      user: {
        client_uuid: 'client-uuid-1',
        telegram_user_id: 42,
        telegram_username: null,
        telegram_photo_url: null,
        locale: null,
        full_name: 'Ada',
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await bootstrapAuth();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.cached).toBe(false);
  });

  test('falls back to VITE_DEV_INIT_DATA when the SDK initData is empty', async () => {
    installMockWebApp('');
    vi.stubEnv('VITE_DEV_INIT_DATA', 'user=%7B%22id%22%3A7%7D&auth_date=1&hash=y');
    const fetchMock = mockFetchResponse({
      jwt: fakeJwt(Math.floor(Date.now() / 1000) + 3600),
      expires_at_epoch: Math.floor(Date.now() / 1000) + 3600,
      user: {
        client_uuid: 'client-uuid-1',
        telegram_user_id: 7,
        telegram_username: null,
        telegram_photo_url: null,
        locale: null,
        full_name: 'Dev User',
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    await bootstrapAuth();

    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toContain('/api/v1/auth/telegram');
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.init_data).toContain('id%22%3A7');
  });

  test('resets the in-flight promise on failure so the next call retries', async () => {
    const failing = vi.fn(async () =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'nope' }),
        text: async () => 'nope',
      } as Response),
    );
    vi.stubGlobal('fetch', failing);

    await expect(bootstrapAuth()).rejects.toThrow(/HTTP 401/);

    const ok = mockFetchResponse({
      jwt: fakeJwt(Math.floor(Date.now() / 1000) + 3600),
      expires_at_epoch: Math.floor(Date.now() / 1000) + 3600,
      user: {
        client_uuid: 'client-uuid-1',
        telegram_user_id: 42,
        telegram_username: null,
        telegram_photo_url: null,
        locale: null,
        full_name: 'Ada',
      },
    });
    vi.stubGlobal('fetch', ok);

    const result = await bootstrapAuth();
    expect(result.jwt).toBeTruthy();
  });
});
