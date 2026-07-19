/**
 * Success state for the due-cards block — a flat list of titles + slot
 * badges. Real card visuals (swipe gestures, streak ring, cue preview)
 * land in T-15 · T-16.
 */

import type { DueConspectus } from '../hooks/useConspectusesDue';

type Props = { items: DueConspectus[] };

export function DueCardsList({ items }: Props) {
  return (
    <ul
      aria-label="Due conspectuses"
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {items.map((item) => (
        <li
          key={item.conspectus_uuid}
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--tg-secondary-bg-color, #232e3c)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: '0.95rem',
                color: 'var(--tg-text-color, #f5f5f7)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.title}
            </div>
            {item.next_review_at && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--tg-hint-color, #708499)',
                  marginTop: 2,
                }}
              >
                {formatNextReview(item.next_review_at)}
              </div>
            )}
          </div>
          <span
            aria-label={`slot ${item.slot}`}
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '0.15rem 0.5rem',
              borderRadius: 999,
              background: 'var(--tg-bg-color, #17212b)',
              color: 'var(--tg-accent-text-color, #6ab3f3)',
              letterSpacing: '0.03em',
            }}
          >
            {item.slot}
          </span>
        </li>
      ))}
    </ul>
  );
}

function formatNextReview(iso: string): string {
  const now = Date.now();
  const target = new Date(iso).getTime();
  const diffMs = target - now;
  if (diffMs <= 0) return 'сейчас';
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `через ${minutes} мин`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `через ${hours} ч`;
  const days = Math.round(hours / 24);
  return `через ${days} дн`;
}
