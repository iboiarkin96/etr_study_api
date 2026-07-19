/**
 * Yesterday-digest strip — three-cell recap of the previous day: how many
 * cards were reviewed, out of the day's target, and hit-rate.
 *
 * Data source: `useDailyStats().yesterday` — mocked; swaps onto
 * `GET /api/v1/me/yesterday` (new) once the endpoint lands.
 *
 * Visual: mirrors `ScheduleSummaryStrip` proportions so the two strips read
 * as a matched pair when stacked.
 */

import { useTranslation } from 'react-i18next';

import type { YesterdayDigest as Data } from '../hooks/useDailyStats';

type Props = { data: Data };

export function YesterdayDigest({ data }: Props) {
  const { t } = useTranslation();
  const hitRateTone = data.accuracyPct >= 80 ? 'positive' : data.accuracyPct >= 60 ? 'neutral' : 'warn';

  const cell = (label: string, value: string | number, tone?: 'positive' | 'neutral' | 'warn') => (
    <div
      key={label}
      style={{
        flex: 1,
        padding: '0.55rem 0.5rem',
        borderRadius: 10,
        background: 'var(--tg-secondary-bg-color, #232e3c)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '1.05rem',
          fontWeight: 600,
          lineHeight: 1.1,
          color:
            tone === 'positive'
              ? 'var(--tg-accent-text-color, #6ab3f3)'
              : tone === 'warn'
                ? 'var(--tg-destructive-text-color, #ec3942)'
                : 'var(--tg-text-color, #f5f5f7)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: '0.62rem',
          color: 'var(--tg-hint-color, #708499)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginTop: 3,
        }}
      >
        {label}
      </div>
    </div>
  );

  return (
    <section aria-labelledby="yesterday-h" style={{ marginTop: '1rem' }}>
      <h2
        id="yesterday-h"
        style={{
          fontSize: '0.75rem',
          color: 'var(--tg-hint-color, #708499)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          margin: '0 0 0.4rem',
        }}
      >
        {t('today.yesterday.title')}
      </h2>
      <div style={{ display: 'flex', gap: 8 }} aria-label={t('today.yesterday.title')}>
        {cell(t('today.yesterday.reviewed'), `${data.reviewed} / ${data.target}`)}
        {cell(t('today.yesterday.accuracy'), `${data.accuracyPct}%`, hitRateTone)}
        {cell(
          t('today.yesterday.missed'),
          Math.max(0, data.target - data.reviewed),
          data.reviewed < data.target ? 'warn' : 'neutral',
        )}
      </div>
    </section>
  );
}
