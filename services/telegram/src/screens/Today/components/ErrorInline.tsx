/**
 * Inline error affordance for a data block. Rendered on kit primitives:
 *
 *   * `.tma-digest` carries the alert copy (icon + main text).
 *   * `.tma-btn.tma-btn--outline` renders the Retry affordance so it
 *     matches every other kit-styled action in the app.
 *
 * The skeleton stays visible above this element so the retry lands in
 * the same layout — that responsibility lives on the caller (Today).
 */

import { useTranslation } from 'react-i18next';

type Props = {
  label: string;
  onRetry: () => void;
};

export function ErrorInline({ label, onRetry }: Props) {
  const { t } = useTranslation();
  return (
    <div className="tma-digest" role="alert" style={{ margin: 'var(--tma-sp-2) 0' }}>
      <div className="tma-digest__icon" data-tone="danger" aria-hidden="true">
        !
      </div>
      <div className="tma-digest__main">
        <div className="tma-digest__title">{label}</div>
      </div>
      <button
        type="button"
        className="tma-btn tma-btn--outline"
        onClick={onRetry}
        style={{ minHeight: 0, padding: '6px 12px', fontSize: 'var(--tma-fs-small)' }}
      >
        {t('today.error.retry')}
      </button>
    </div>
  );
}
