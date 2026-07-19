/**
 * Runs the auth bootstrap on mount and exposes `{ status, jwt, user }` +
 * a typed API client to the tree via context.
 *
 * Status machine:
 *
 *   'idle'          — before the first mount effect fires
 *   'authenticating' — bootstrap request in flight (initial cold open)
 *   'authenticated' — JWT + user block available; API calls will carry them
 *   'error'         — bootstrap threw; children get a retry helper
 *
 * The provider mounts inside QueryClientProvider so failed auth surfaces on
 * the same TanStack Query state boundary the rest of the app uses.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { bootstrapAuth } from '../shared/auth/bootstrap';
import { createApiClient } from '../shared/api/client';

import { AuthContext, type AuthState } from './auth-context';

const initialState: AuthState = {
  status: 'idle',
  jwt: null,
  user: null,
  error: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState);
  const [retryTick, setRetryTick] = useState(0);

  const api = useMemo(
    () =>
      createApiClient({
        read: () => state.jwt,
        onUnauthorized: () => {
          setState((prev) => ({ ...prev, status: 'error', error: new Error('Session expired.') }));
        },
      }),
    [state.jwt],
  );

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, status: 'authenticating', error: null }));
    bootstrapAuth().then(
      (result) => {
        if (cancelled) return;
        setState({
          status: 'authenticated',
          jwt: result.jwt,
          user: result.user,
          error: null,
        });
      },
      (err: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          jwt: null,
          user: null,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [retryTick]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        api,
        retry: () => setRetryTick((n) => n + 1),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
