/**
 * Three-count schedule strip: due-now / next-24h / total-active.
 *
 * Uses the kit's spacing / radius / typography tokens directly — this
 * shape (three equal tabular-numeric cells) doesn't have a native
 * primitive in the kit. Elevation + tokens keep it flush with the
 * neighbouring `.tma-digest` and `.tma-section__plate` blocks.
 */

import { useTranslation } from 'react-i18next';

import type { ScheduleSummary } from '../hooks/useScheduleSummary';

type Props = { data: ScheduleSummary };

export function ScheduleSummaryStrip({ data }: Props) {
  const { t } = useTranslation();

  const cell = (label: string, value: number, tone?: 'accent') => (
    <div
      key={label}
      style={{
        flex: 1,
        padding: 'var(--tma-sp-3) var(--tma-sp-2)',
        borderRadius: 'var(--tma-rad-3)',
        background: 'var(--tma-surface-plate)',
        boxShadow: 'var(--tma-elev-1)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: 'var(--tma-fs-h3)',
          fontWeight: 'var(--tma-fw-heavy)',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          color:
            tone === 'accent' ? 'var(--tma-ember-500)' : 'var(--tma-text-primary)',
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 9,
          color: 'var(--tma-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          marginTop: 'var(--tma-sp-1)',
          fontWeight: 'var(--tma-fw-semi)',
        }}
      >
        {label}
      </div>
    </div>
  );

  return (
    <div
      className="tma-tip"
      role="group"
      aria-label={t('today.summary.dueNow')}
      data-tip={t('today.summary.tip')}
      style={{
        display: 'flex',
        gap: 'var(--tma-sp-2)',
        margin: 'var(--tma-sp-3) var(--tma-sp-4)',
      }}
    >
      {cell(t('today.summary.dueNow'), data.due_now, 'accent')}
      {cell(t('today.summary.next24h'), data.due_next_24h)}
      {cell(t('today.summary.total'), data.total)}
    </div>
  );
}
