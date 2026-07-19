/**
 * Empty state — «All caught up for today».
 *
 * Renders inside a `.tma-section__plate` so the empty rail matches the
 * dense list that would otherwise sit there. The kit's sage orb variant
 * (`data-state="rested"`) sits next to the copy per the design spec
 * (screens.html § ed-states — «Nothing due»): the surface stays alive
 * even when there's zero work.
 */

import { useTranslation } from 'react-i18next';

export function EmptyToday() {
  const { t } = useTranslation();
  return (
    <div
      className="tma-section__plate"
      style={{
        padding: 'var(--tma-sp-6) var(--tma-sp-4)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--tma-sp-4)',
      }}
    >
      <div
        className="tma-orb tma-orb--sm"
        data-state="rested"
        role="img"
        aria-label="rested"
      >
        <span className="tma-orb__sheen" aria-hidden="true" />
        <span className="tma-orb__glare" aria-hidden="true" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--tma-fs-body)',
            fontWeight: 'var(--tma-fw-semi)',
            color: 'var(--tma-text-primary)',
          }}
        >
          {t('today.empty.title')}
        </div>
        <div
          style={{
            fontSize: 'var(--tma-fs-small)',
            color: 'var(--tma-text-tertiary)',
            marginTop: 'var(--tma-sp-1)',
            lineHeight: 'var(--tma-lh-snug)',
          }}
        >
          {t('today.empty.hint')}
        </div>
      </div>
    </div>
  );
}
