/**
 * Yesterday-digest strip — one-line recap of the previous day rendered on
 * the `.tma-digest` primitive.
 *
 * Reads the `YesterdayDigest` shape returned by `GET /api/v1/me/yesterday`
 * — `reviewed`, `target`, `accuracy_pct`, `missed`. The icon tone tracks
 * accuracy so the strip carries a mood at-a-glance.
 */

import { useTranslation } from 'react-i18next';

import type { components } from '../../../shared/api/schema';

type YesterdayDigestData = components['schemas']['YesterdayDigest'];

type Props = { data: YesterdayDigestData };

type Tone = 'success' | 'warn' | 'danger';

function pickTone(accuracyPct: number): Tone {
  if (accuracyPct >= 80) return 'success';
  if (accuracyPct >= 60) return 'warn';
  return 'danger';
}

export function YesterdayDigest({ data }: Props) {
  const { t } = useTranslation();
  const tone = pickTone(data.accuracy_pct);

  return (
    <div
      className="tma-digest"
      role="group"
      aria-label={t('today.yesterday.title')}
      title={t('today.yesterday.tip')}
    >
      <div className="tma-digest__icon" data-tone={tone} aria-hidden="true">
        {tone === 'success' ? '✓' : tone === 'warn' ? '·' : '!'}
      </div>
      <div className="tma-digest__main">
        <div className="tma-digest__title">{t('today.yesterday.title')}</div>
        <div className="tma-digest__sub">
          {t('today.yesterday.summary', {
            reviewed: data.reviewed,
            target: data.target,
            accuracy: data.accuracy_pct,
            missed: data.missed,
          })}
        </div>
      </div>
    </div>
  );
}
