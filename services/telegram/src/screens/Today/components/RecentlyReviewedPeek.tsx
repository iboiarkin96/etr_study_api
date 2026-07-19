/**
 * Recently-reviewed peek — quiet editorial mini-list on `.tma-peek--lined`.
 *
 * Every row is a `<Link>` to the same `/conspectus/$conspectus_uuid` route
 * the due list uses, so «recently reviewed» is a proper drill-down surface
 * and not just decoration. Self-hides on an empty list.
 *
 * Data source: derived from `useConspectusesDue` — until a dedicated
 * `GET /conspectuses?sort=-last_reviewed_at&limit=5` hook lands.
 */

import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import type { DueConspectus } from '../hooks/useConspectusesDue';

type Props = { items: DueConspectus[] };

export function RecentlyReviewedPeek({ items }: Props) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  return (
    <section
      className="tma-section"
      aria-labelledby="recent-h"
      style={{ margin: '0 var(--tma-sp-4)' }}
    >
      <div
        className="tma-peek tma-peek--lined tma-tip"
        role="list"
        data-tip={t('today.recent.tip')}
      >
        <div className="tma-peek__label" id="recent-h">
          {t('today.recent.title')}
        </div>
        {items.map((item) => (
          <Link
            key={item.conspectus_uuid}
            to="/conspectus/$conspectus_uuid"
            params={{ conspectus_uuid: item.conspectus_uuid }}
            className="tma-peek__row"
            role="listitem"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
              {item.title}
            </span>
            <span className="tma-peek__meta">{t('today.recent.slot', { slot: item.slot })}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
