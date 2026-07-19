/**
 * Inline error affordance for a data block. Per the on-call playbook the
 * user should always see «what broke» + «how to retry»; the skeleton
 * stays visible so the retry re-lands in the same layout (design contract).
 */

import { useTranslation } from 'react-i18next';

type Props = {
  label: string;
  onRetry: () => void;
};

export function ErrorInline({ label, onRetry }: Props) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      style={{
        padding: '0.85rem 1rem',
        borderRadius: 10,
        background: 'var(--tg-secondary-bg-color, #2b1e22)',
        color: 'var(--tg-destructive-text-color, #ec3942)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
      }}
    >
      <div style={{ flex: 1, fontSize: '0.85rem' }}>{label}</div>
      <button
        type="button"
        onClick={onRetry}
        style={{
          background: 'var(--tg-button-color, #3390ec)',
          color: 'var(--tg-button-text-color, #ffffff)',
          border: 'none',
          borderRadius: 8,
          padding: '0.4rem 0.85rem',
          fontSize: '0.8rem',
          cursor: 'pointer',
        }}
      >
        {t('today.error.retry')}
      </button>
    </div>
  );
}
