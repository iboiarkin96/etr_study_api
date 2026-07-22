/**
 * Unit tests for useOnboardingSeen (T-24).
 *
 * The hook is the single source of truth for the first-run flag:
 *   1. Fresh state → `'unseen'` after cloud read resolves.
 *   2. A prior local mirror → `'seen'` skipping the cloud read entirely.
 *   3. A prior cloud value with no local mirror → `'seen'` on hydration.
 *   4. `markSeen()` flips state and writes both mirrors.
 *   5. A missing Telegram shim falls back to `'unseen'` without crashing.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { useOnboardingSeen } from './useOnboardingSeen';

const KEY = 'onboarding_done';

type CloudCb = (err: Error | null, value: string | null) => void;

/** Some environments (older happy-dom builds under Node 26) leave
 *  `window.localStorage` undefined. Install a Map-backed shim once so
 *  the hook can read/write the mirror without a runtime error. */
function ensureLocalStorage(): Storage {
  if (typeof window.localStorage !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  const store = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? (store.get(k) as string) : null),
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => {
      store.delete(k);
    },
    setItem: (k, v) => {
      store.set(k, String(v));
    },
  };
  Object.defineProperty(window, 'localStorage', {
    value: shim,
    configurable: true,
    writable: true,
  });
  return shim;
}

function installMockCloudStorage(prefilled: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(prefilled));
  const setter = { calls: [] as Array<{ key: string; value: string }> };
  window.Telegram = {
    WebApp: {
      CloudStorage: {
        getItem: (key: string, cb: CloudCb) => {
          // Microtask defer — matches the real SDK's async callback shape so
          // the initial render observes `'unknown'`.
          queueMicrotask(() => cb(null, store.get(key) ?? null));
        },
        setItem: (key: string, value: string, cb?: (e: Error | null) => void) => {
          store.set(key, value);
          setter.calls.push({ key, value });
          cb?.(null);
        },
        removeItem: (key: string, cb?: (e: Error | null) => void) => {
          store.delete(key);
          cb?.(null);
        },
      },
    },
  } as unknown as (typeof window)['Telegram'];
  return { store, setter };
}

beforeEach(() => {
  ensureLocalStorage().clear();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
});

afterEach(() => {
  ensureLocalStorage().clear();
});

describe('useOnboardingSeen', () => {
  test('fresh user hydrates to unseen', async () => {
    installMockCloudStorage();
    const { result } = renderHook(() => useOnboardingSeen());
    expect(result.current.state).toBe('unknown');
    await waitFor(() => expect(result.current.state).toBe('unseen'));
  });

  test('a local mirror short-circuits to seen without a cloud read', async () => {
    installMockCloudStorage();
    window.localStorage.setItem(KEY, '1');
    const { result } = renderHook(() => useOnboardingSeen());
    // Lazy initializer resolves synchronously — no `'unknown'` window,
    // so OnboardingGate mounts already in `'seen'` and never blanks Today.
    expect(result.current.state).toBe('seen');
  });

  test('a prior cloud value hydrates to seen', async () => {
    installMockCloudStorage({ [KEY]: '1' });
    const { result } = renderHook(() => useOnboardingSeen());
    await waitFor(() => expect(result.current.state).toBe('seen'));
  });

  test('markSeen flips state and writes both mirrors', async () => {
    const { setter } = installMockCloudStorage();
    const { result } = renderHook(() => useOnboardingSeen());
    await waitFor(() => expect(result.current.state).toBe('unseen'));
    act(() => result.current.markSeen());
    expect(result.current.state).toBe('seen');
    expect(window.localStorage.getItem(KEY)).toBe('1');
    await waitFor(() => expect(setter.calls).toEqual([{ key: KEY, value: '1' }]));
  });

  test('missing CloudStorage shim falls back to unseen without crashing', async () => {
    const { result } = renderHook(() => useOnboardingSeen());
    await waitFor(() => expect(result.current.state).toBe('unseen'));
    act(() => result.current.markSeen());
    expect(result.current.state).toBe('seen');
    expect(window.localStorage.getItem(KEY)).toBe('1');
  });
});
