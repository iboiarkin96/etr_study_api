/**
 * Format an ISO datetime as a relative-time label using the shared
 * `today.nextReview.*` i18n bucket. Single source for both Today's
 * DueCardsList (subtitle under each card) and Focus (post-grade
 * «Next review in N…» ticker) — so the two surfaces can't drift on
 * threshold buckets or copy.
 *
 * Buckets:
 *   <= 0        → «now»
 *   < 60 min    → «in N min»
 *   < 24 h      → «in N h»
 *   >= 24 h     → «in N d»
 */

import type { TFunction } from 'i18next';

export function formatRelative(iso: string, t: TFunction): string {
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
