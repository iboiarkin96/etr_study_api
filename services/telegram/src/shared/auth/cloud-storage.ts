/**
 * Promise wrappers over Telegram SDK's callback-style `CloudStorage`.
 *
 * The SDK exposes `(err, value)` callbacks (Node-style); every call-site
 * would repeat the same boilerplate. Wrap once, keep the async surface flat.
 * Falls back to a no-op read (`null`) when the shim is missing, so the auth
 * bootstrap can still run in tests / mocked environments without crashing.
 */

type CloudStorage = {
  setItem: (key: string, value: string, cb?: (err: Error | null) => void) => void;
  getItem: (
    key: string,
    cb: (err: Error | null, value: string | null) => void,
  ) => void;
  removeItem: (key: string, cb?: (err: Error | null) => void) => void;
};

function cloudStorage(): CloudStorage | null {
  return window.Telegram?.WebApp?.CloudStorage ?? null;
}

/** Some Telegram builds (older iOS/Android WebViews, occasionally 9.x
 * after a background/foreground swap) hand us a CloudStorage object whose
 * callbacks silently never fire. A callback that never resolves would
 * hang bootstrapAuth() forever — the Today screen sticks on «Connecting
 * to the server…» and there is no way for the user to recover short of
 * closing and reopening the Mini App. A short timeout falls back to
 * «cache empty» so the caller can proceed to a fresh initData exchange. */
const CLOUD_STORAGE_TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), CLOUD_STORAGE_TIMEOUT_MS);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        window.clearTimeout(timer);
        resolve(fallback);
      });
  });
}

export function cloudGet(key: string): Promise<string | null> {
  const store = cloudStorage();
  if (!store) return Promise.resolve(null);
  return withTimeout(
    new Promise<string | null>((resolve, reject) => {
      store.getItem(key, (err, value) => {
        if (err) reject(err);
        else resolve(value ?? null);
      });
    }),
    null,
  );
}

export function cloudSet(key: string, value: string): Promise<void> {
  const store = cloudStorage();
  if (!store) return Promise.resolve();
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      store.setItem(key, value, (err) => {
        if (err) reject(err);
        else resolve();
      });
    }),
    undefined,
  );
}

export function cloudRemove(key: string): Promise<void> {
  const store = cloudStorage();
  if (!store) return Promise.resolve();
  return withTimeout(
    new Promise<void>((resolve, reject) => {
      store.removeItem(key, (err) => {
        if (err) reject(err);
        else resolve();
      });
    }),
    undefined,
  );
}
