/**
 * Recently-reviewed peek — replaces the earlier horizontal carousel.
 *
 * Renders on `.tma-peek--lined` from `tma-kit.css` per the variant A DNA:
 * a quiet, editorial mini-list where the eye lands on the *titles* and
 * slot letter sits in the right-aligned mono meta column. Self-hides
 * on an empty list so the label doesn't appear without content.
 *
 * Data source: derived from `useConspectusesDue` — until a dedicated
 * `GET /conspectuses?sort=-last_reviewed_at&limit=5` hook lands.
 */

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
      <div className="tma-peek tma-peek--lined" role="list">
        <div className="tma-peek__label" id="recent-h">
          {t('today.recent.title')}
        </div>
        {items.map((item) => (
          <div key={item.conspectus_uuid} className="tma-peek__row" role="listitem">
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
          </div>
        ))}
      </div>
    </section>
  );
}
