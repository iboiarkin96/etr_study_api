/**
 * AppErrorBoundary — catches uncaught render + effect errors from the
 * provider shell ABOVE the router (auth bootstrap, theme, toasts) and
 * shows the shared `<BoundaryFallback>` — the same warm `<ErrorScreen>`
 * surface the auth handshake failure uses.
 *
 * Route-component errors do NOT reach this boundary: TanStack Router
 * wraps every route in its own catch boundary first. That tier is
 * covered by `defaultErrorComponent` in `router.tsx`, which renders the
 * same `<BoundaryFallback>` — see that file for the split.
 *
 * Recovery paths:
 *   * «Try again» — resets the boundary's internal state; the tree
 *     re-renders. Fine for transient errors (network blip, one-off
 *     race condition).
 *   * «Reload the app» — forces a full `location.reload()`. Nuclear
 *     option for anything that survives an in-place retry.
 *
 * `componentDidCatch` logs to the console today; when Sentry lands (T-26d),
 * that call gets swapped for `Sentry.captureException(error)` so we see
 * these crashes with a real trace instead of just the user's report.
 *
 * A class component because React's error boundary API is class-only —
 * there is no hook equivalent. Kept minimal so the class-vs-hook
 * mismatch never leaks past this file.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

import { captureError } from '../shared/observability';
import { BoundaryFallback } from './BoundaryFallback';

type Props = { children: ReactNode };

type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Sentry when VITE_SENTRY_DSN is set (see shared/observability/sentry.ts);
    // console.error otherwise. Same call shape either way — the
    // component stack becomes a Sentry `contexts.react.componentStack`
    // field and shows in the issue's React panel.
    captureError(error, { componentStack: info.componentStack });
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return <BoundaryFallback onRetry={() => this.setState({ error: null })} />;
  }
}
