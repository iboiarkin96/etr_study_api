/**
 * BoundaryFallback — the shared «app crashed» surface.
 *
 * Rendered by BOTH error tiers:
 *   * TanStack Router's `defaultErrorComponent` (router.tsx) — catches
 *     throws from route components. Without this override the router's
 *     built-in ErrorComponent ships its own dev-style fallback
 *     («Something went wrong!» + red <pre>) — in prod too, since it's
 *     runtime router code, not a dev overlay.
 *   * `AppErrorBoundary` — catches throws from the provider shell above
 *     the router (auth bootstrap, theme, toasts).
 *
 * One component so the two tiers can never drift visually.
 */

import { useTranslation } from 'react-i18next';

import { ErrorScreen } from '../screens/Today/components/ErrorScreen';

type Props = {
  /** Reset the owning boundary so the tree re-renders. */
  onRetry: () => void;
};

export function BoundaryFallback({ onRetry }: Props) {
  const { t } = useTranslation();
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
        onRetry={onRetry}
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
