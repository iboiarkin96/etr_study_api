/**
 * Due-cards list — `.tma-section__plate` + `.tma-cell` rows per variant A.
 *
 * Each row is a `<Link>` to `/conspectus/$uuid` so a tap opens the detail
 * screen. Icon tone tracks the ETR slot (A = accent, B = info, C = success,
 * D = warn).  Swipe-to-review lands with T-16.
 */

import { Link } from '@tanstack/react-router';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type { DueConspectus } from '../hooks/useConspectusesDue';

type Props = { items: DueConspectus[] };

const SLOT_TONE: Record<string, 'accent' | 'success' | 'info' | 'warn'> = {
  A: 'accent',
  B: 'info',
  C: 'success',
  D: 'warn',
};

export function DueCardsList({ items }: Props) {
  const { t } = useTranslation();
  return (
    <div className="tma-section__plate" role="list" aria-label={t('today.dueSection')}>
      {items.map((item) => (
        <Link
          key={item.conspectus_uuid}
          to="/conspectus/$conspectus_uuid"
          params={{ conspectus_uuid: item.conspectus_uuid }}
          className="tma-cell"
          role="listitem"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="tma-cell__icon" data-tone={SLOT_TONE[item.slot] ?? 'accent'}>
            {item.slot}
          </div>
          <div className="tma-cell__main">
            <div className="tma-cell__title">{item.title}</div>
            {item.next_review_at && (
              <div className="tma-cell__subtitle">
                {formatNextReview(item.next_review_at, t)}
              </div>
            )}
          </div>
          <div className="tma-cell__aside">{item.slot}</div>
          <div className="tma-cell__chevron" aria-hidden="true">
            ›
          </div>
        </Link>
      ))}
    </div>
  );
}

function formatNextReview(iso: string, t: TFunction): string {
  const now = Date.now();
  const target = new Date(iso).getTime();
  const diffMs = target - now;
  if (diffMs <= 0) return t('today.nextReview.now');
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return t('today.nextReview.inMinutes', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('today.nextReview.inHours', { count: hours });
  const days = Math.round(hours / 24);
  return t('today.nextReview.inDays', { count: days });
}
