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
          <AuthProvider>
            <Router />
          </AuthProvider>
        </ViewportProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
