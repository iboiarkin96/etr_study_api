/**
 * Pure resolver for the Focus session-complete scenario.
 *
 * Extracted into its own file so React Fast Refresh treats
 * `SessionCompleteOrb.tsx` as component-only, and so tests + Storybook
 * stories can import the numeric contract without pulling the component
 * into the graph.
 */

import type { SessionSummary } from '../hooks/useFocusSession';

export type CompletionScenario = 'celebrate' | 'solid' | 'rough';

/** Threshold for celebrate: 80 % accuracy AND no forgotten cards. */
export const CELEBRATE_ACCURACY = 0.8;
/** Threshold for rough: below 50 % accuracy — «I struggled through this». */
export const ROUGH_ACCURACY = 0.5;
/** Rough also fires when Again-share is too high, even at OK accuracy. */
export const ROUGH_AGAIN_SHARE = 0.4;

export function resolveScenario(summary: SessionSummary): CompletionScenario {
  const total = summary.graded;
  if (total === 0) return 'solid';
  const correct = summary.perGrade.easy + summary.perGrade.good;
  const accuracy = correct / total;
  const againShare = summary.perGrade.again / total;
  if (accuracy >= CELEBRATE_ACCURACY && summary.perGrade.again === 0) return 'celebrate';
  if (accuracy < ROUGH_ACCURACY || againShare >= ROUGH_AGAIN_SHARE) return 'rough';
  return 'solid';
}
