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

export function cloudGet(key: string): Promise<string | null> {
  const store = cloudStorage();
  if (!store) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    store.getItem(key, (err, value) => {
      if (err) reject(err);
      else resolve(value ?? null);
    });
  });
}

export function cloudSet(key: string, value: string): Promise<void> {
  const store = cloudStorage();
  if (!store) return Promise.resolve();
  return new Promise((resolve, reject) => {
    store.setItem(key, value, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function cloudRemove(key: string): Promise<void> {
  const store = cloudStorage();
  if (!store) return Promise.resolve();
  return new Promise((resolve, reject) => {
    store.removeItem(key, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
