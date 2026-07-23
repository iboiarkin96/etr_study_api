/**
 * Pure gesture-to-tag resolvers for the swipe row in `DueCardsList`.
 *
 * Kept in its own file so the component file exports only components
 * (Fast Refresh requirement) and so unit tests / docs can import the
 * numeric contract without pulling framer-motion into the graph.
 */

import type { ReviewTag } from '../hooks/useReviewConspectus';

/** Pixel thresholds — arm reveals the bg, commit fires the mutation. */
export const SWIPE_THRESHOLDS = {
  ARM: 40,
  COMMIT: 100,
  COMMIT_DEEP: 200,
} as const;

export function resolveTag(offsetX: number): ReviewTag | null {
  if (offsetX >= SWIPE_THRESHOLDS.COMMIT) return 'easy';
  if (offsetX <= -SWIPE_THRESHOLDS.COMMIT_DEEP) return 'forgot';
  if (offsetX <= -SWIPE_THRESHOLDS.COMMIT) return 'hard';
  return null;
}

export function resolveTone(offsetX: number): 'accent' | 'warn' | 'danger' {
  if (offsetX >= 0) return 'accent';
  if (offsetX <= -SWIPE_THRESHOLDS.COMMIT_DEEP) return 'danger';
  return 'warn';
}
