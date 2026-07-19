/**
 * Yesterday-digest strip — one-line recap of the previous day, rendered on
 * the shipped `.tma-digest` primitive from `tma-kit.css`.
 *
 * The kit's digest is a single row (icon + main text). The icon tone tracks
 * accuracy so the strip carries a mood at-a-glance without needing colour
 * in the copy itself.
 */

import { useTranslation } from 'react-i18next';

import type { YesterdayDigest as Data } from '../hooks/useDailyStats';

type Props = { data: Data };

type Tone = 'success' | 'warn' | 'danger';

function pickTone(accuracyPct: number): Tone {
  if (accuracyPct >= 80) return 'success';
  if (accuracyPct >= 60) return 'warn';
  return 'danger';
}

export function YesterdayDigest({ data }: Props) {
  const { t } = useTranslation();
  const tone = pickTone(data.accuracyPct);
  const missed = Math.max(0, data.target - data.reviewed);

  return (
    <div className="tma-digest" role="group" aria-label={t('today.yesterday.title')}>
      <div className="tma-digest__icon" data-tone={tone} aria-hidden="true">
        {tone === 'success' ? '✓' : tone === 'warn' ? '·' : '!'}
      </div>
      <div className="tma-digest__main">
        <div className="tma-digest__title">{t('today.yesterday.title')}</div>
        <div className="tma-digest__sub">
          {t('today.yesterday.summary', {
            reviewed: data.reviewed,
            target: data.target,
            accuracy: data.accuracyPct,
            missed,
          })}
        </div>
      </div>
    </div>
  );
}
