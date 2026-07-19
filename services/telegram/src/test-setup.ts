import '@testing-library/react';

// happy-dom does not implement `crypto.randomUUID` in every version — polyfill
// so the shared/api/client's request-id + idempotency-key generation runs.
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () =>
        `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-4000-8000-000000000000`,
    },
    configurable: true,
  });
}
