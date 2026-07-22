/**
 * Compose the four W3-boundary providers:
 *
 *   QueryClientProvider  — TanStack Query cache (server-state)
 *   ThemeProvider        — Telegram themeParams → --tg-* CSS vars
 *   ViewportProvider     — safe-area insets + viewport height → --tma-* CSS vars
 *   Router               — TanStack Router with the initial route tree
 *
 * Assembly order matters. Theme + Viewport must be inside QueryClient so any
 * future data hook can read Query state; Router is innermost so route
 * components see all four contexts.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { ToastProvider, Toaster } from '../shared/toast/toast';
import { AppErrorBoundary } from './AppErrorBoundary';
import { AuthGate } from './AuthGate';
import { AuthProvider } from './auth-provider';
import { Router } from './router';
import { ThemeProvider } from './theme-provider';
import { ViewportProvider } from './viewport-provider';

export function Providers() {
  // One QueryClient per mount — kept in state so a hot-reload in dev does not
  // reset it accidentally.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ViewportProvider>
          {/* AppErrorBoundary sits inside ThemeProvider + ViewportProvider so
            * its `<ErrorScreen>` fallback still resolves the app's tokens and
            * safe-area vars, but outside AuthProvider so an error thrown *by*
            * the auth bootstrap surfaces here instead of vanishing under a
            * broken auth gate. */}
          <AppErrorBoundary>
            <AuthProvider>
              <ToastProvider>
                <AuthGate>
                  <Router />
                </AuthGate>
                {/* Toaster mounts inside ToastProvider AND inside AuthProvider
                  * so a mutation callback can push a toast during the auth
                  * handshake itself. Kept above AuthGate so the toast survives
                  * a gate flip (splash → app) without unmount. */}
                <Toaster />
              </ToastProvider>
            </AuthProvider>
          </AppErrorBoundary>
        </ViewportProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
