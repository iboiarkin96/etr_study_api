/**
 * MissPeek — quiet 1-line pill under YesterdayDigest that surfaces the
 * count of retrieval misses in the last 7 days and links to `/errors`.
 *
 * Rendered only when count > 0 — zero-state has nothing to say. Reads as
 * a peek (D3), not a CTA (D2 is «Start Focus» above it). Pill primitive
 * reuses the ember-tinted plate + arrow tail so it can never drift from
 * Today's other section headers.
 */

import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useErrors } from '../../Errors/hooks/useErrors';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function MissPeek() {
  const { t } = useTranslation();
  const list = useErrors();

  const weeklyCount = useMemo(() => {
    if (!list.data) return 0;
    const cutoff = Date.now() - WEEK_MS;
    return list.data.filter((r) => new Date(r.created_at).getTime() >= cutoff).length;
  }, [list.data]);

  // Do NOT render on zero — no misses this week is not a peek, it's silence.
  // Do NOT render while pending — flickering the pill in on late data is
  //   worse than never showing it. Skeleton would be louder than the pill.
  if (!list.data || weeklyCount === 0) return null;

  return (
    <div style={{ padding: '0 var(--tma-sp-4)', marginTop: 'var(--tma-sp-3)' }}>
      <Link
        to="/errors"
        className="tma-miss-peek"
        aria-label={t('today.missPeek.aria', { count: weeklyCount })}
      >
        <span className="tma-miss-peek__dot" aria-hidden="true" />
        <span className="tma-miss-peek__label">
          {t('today.missPeek.label', { count: weeklyCount })}
        </span>
        <span className="tma-miss-peek__arrow" aria-hidden="true">
          →
        </span>
      </Link>
    </div>
  );
}
