/**
 * AppErrorBoundary — catches uncaught render + effect errors from
 * anywhere inside the app tree and shows the same warm `<ErrorScreen>`
 * the auth handshake failure surface uses. Before this boundary shipped,
 * a component crash surfaced Vite's raw dev overlay to the user (red
 * banner, source line quote) — fine for a developer's laptop, actively
 * hostile inside a Mini App WebView where there is no console to reach
 * and no way to reload short of closing the sheet.
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
 * there is no hook equivalent. Kept minimal (~50 lines of class body)
 * so the class-vs-hook mismatch never leaks past this file.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { withTranslation, type WithTranslation } from 'react-i18next';

import { ErrorScreen } from '../screens/Today/components/ErrorScreen';

type Props = WithTranslation & { children: ReactNode };

type State = { error: Error | null };

class AppErrorBoundaryInner extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log until a real observability sink lands (T-26d). Kept as a
    // single-line console.error so the browser groups the error's own
    // stack together with our tagged prefix — no need to expand a
    // multi-line group to see the payload.
    console.error('[AppErrorBoundary] caught render/effect error:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    const { t, children } = this.props;
    if (!error) return children;
    return (
      <main
        className="tma-scope"
        data-density="regular"
        style={{
          minHeight: 'var(--tma-viewport-h, 100dvh)',
          background: 'var(--tma-surface-canvas)',
          color: 'var(--tma-text-primary)',
        }}
      >
        <ErrorScreen
          title={t('boundary.title')}
          body={t('boundary.body')}
          ctaLabel={t('boundary.retry')}
          onRetry={() => this.setState({ error: null })}
        />
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--tma-sp-4)',
          }}
        >
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              appearance: 'none',
              border: 0,
              background: 'transparent',
              color: 'var(--tma-text-tertiary)',
              fontSize: 'var(--tma-fs-small)',
              padding: 'var(--tma-sp-2) var(--tma-sp-4)',
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            {t('boundary.reload')}
          </button>
        </div>
      </main>
    );
  }
}

export const AppErrorBoundary = withTranslation()(AppErrorBoundaryInner);
