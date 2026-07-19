/**
 * Empty state — «All caught up for today». Per the design contract on
 * `services/portal/internal/services/telegram/design/screens.html` this
 * is a calm, single-message screen, not a placeholder. Rotating tip +
 * next-review-in copy land alongside the real UI in T-15.
 */

import { useTranslation } from 'react-i18next';

export function EmptyToday() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '2.5rem 1rem',
        color: 'var(--tg-hint-color, #708499)',
      }}
    >
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }} aria-hidden="true">
        ✨
      </div>
      <div style={{ fontSize: '1.05rem', color: 'var(--tg-text-color, #f5f5f7)' }}>
        {t('today.empty.title')}
      </div>
      <div style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
        {t('today.empty.hint')}
      </div>
    </div>
  );
}
