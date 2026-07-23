/**
 * React context value shape + factory for the auth state.
 * Split from `auth-provider.tsx` so React Fast Refresh keeps working
 * (files that export components should only export components).
 */

import { createContext } from 'react';

import type { BootstrapedUser } from '../shared/auth/bootstrap';
import type { ApiClient } from '../shared/api/client';

export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'error';

export type AuthState = {
  status: AuthStatus;
  jwt: string | null;
  user: BootstrapedUser | null;
  error: Error | null;
};

export type AuthContextValue = AuthState & {
  api: ApiClient;
  retry: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
