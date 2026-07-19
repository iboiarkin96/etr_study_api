/**
 * Recently-reviewed carousel — a horizontal scroller of the last few
 * conspectuses the user touched, so re-opening a specific note is one tap
 * away from Today.
 *
 * Data source: for now derived from the due list (T-14 hook) — cut to five
 * items so the mock renders. Swap point: a dedicated
 * `GET /api/v1/conspectuses?sort=-last_reviewed_at&limit=5` hook lands
 * alongside the ProfileScreen work.
 *
 * Scrolling: pure native horizontal overflow with `scroll-snap` on each
 * card. No dependency and no manual gesture code — the OS handles inertia.
 */

import { useTranslation } from 'react-i18next';

import type { DueConspectus } from '../hooks/useConspectusesDue';

type Props = { items: DueConspectus[] };

export function RecentlyReviewedCarousel({ items }: Props) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="recent-h" style={{ marginTop: '1.25rem' }}>
      <h2
        id="recent-h"
        style={{
          fontSize: '0.75rem',
          color: 'var(--tg-hint-color, #708499)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          margin: '0 0 0.5rem',
        }}
      >
        {t('today.recent.title')}
      </h2>
      <ul
        aria-label={t('today.recent.title')}
        style={{
          listStyle: 'none',
          margin: 0,
          padding: '0 0 4px',
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {items.map((item) => (
          <li
            key={item.conspectus_uuid}
            style={{
              minWidth: 190,
              maxWidth: 220,
              flex: '0 0 auto',
              padding: '0.7rem 0.85rem',
              borderRadius: 12,
              background: 'var(--tg-secondary-bg-color, #232e3c)',
              scrollSnapAlign: 'start',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: '0.65rem',
                  color: 'var(--tg-hint-color, #708499)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {t('today.recent.slot', { slot: item.slot })}
              </span>
              <span
                aria-hidden="true"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: 'var(--tg-accent-text-color, #6ab3f3)',
                }}
              />
            </div>
            <div
              style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: 'var(--tg-text-color, #f5f5f7)',
                lineHeight: 1.25,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item.title}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
