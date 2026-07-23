/**
 * Typed event emitters — the ONLY entry point call-sites should use.
 *
 * The property vocabulary is fixed by `reference/event-spec.html`. Every
 * new event goes through this file so:
 *   * TypeScript refuses to compile a call that spells a property wrong.
 *   * A grep for `trackReviewCompleted` finds every callsite instantly.
 *   * The event-spec doc + the code cannot silently drift — the doc's
 *     table columns become the TS union types below.
 *
 * When you add a row to `event-spec.html`, add the emitter here (and its
 * types); when you delete a row, delete the emitter (TS errors surface
 * every dead callsite).
 */

import { track } from './posthog';

// ── Session ────────────────────────────────────────────────────────────

export type LaunchSource = 'bot_button' | 'deep_link' | 'direct';
export type TgPlatform = 'ios' | 'android' | 'tdesktop' | 'weba' | 'macos' | 'unknown';

export function trackAppOpened(props: {
  launch_source: LaunchSource;
  tg_platform: TgPlatform;
  language: 'ru' | 'en';
}): void {
  track('app_opened', props);
}

export type ScreenName =
  | 'today'
  | 'focus'
  | 'errors'
  | 'schedule'
  | 'profile'
  | 'search'
  | 'onboarding'
  | 'conspectus_detail'
  | 'encode';

export function trackScreenViewed(props: {
  screen: ScreenName;
  via: 'tap' | 'back' | 'deep_link' | 'swipe';
}): void {
  track('screen_viewed', props);
}

// ── Review flow ────────────────────────────────────────────────────────

export function trackReviewCompleted(props: {
  tag: 'easy' | 'hard' | 'forgot';
  via: 'focus_grade' | 'swipe';
  /** Time between card reveal and grade tap, in ms. Null when the user
   * grades without revealing (swipe-from-Today path). */
  reveal_ms: number | null;
}): void {
  track('review_completed', props);
}

export function trackReviewSnoozed(props: { screen: 'today' | 'focus' }): void {
  track('review_snoozed', props);
}

export function trackFocusSessionStarted(props: { queue_length: number }): void {
  track('focus_session_started', props);
}

export function trackFocusSessionEnded(props: {
  reason: 'completed' | 'exited' | 'backgrounded';
  reviews_count: number;
  duration_ms: number;
}): void {
  track('focus_session_ended', props);
}

// ── Errors / miss log ──────────────────────────────────────────────────

export function trackErrorLogged(props: {
  from_screen: 'errors' | 'focus';
  has_source_conspectus: boolean;
}): void {
  track('error_logged', props);
}

// ── Streak ─────────────────────────────────────────────────────────────

export function trackStreakBroken(props: { previous_streak: number; days_missed: number }): void {
  track('streak_broken', props);
}

export function trackStreakMilestone(props: { days: 7 | 30 | 100 | 365 }): void {
  track('streak_milestone', props);
}

// ── Search ─────────────────────────────────────────────────────────────

export function trackSearchOpened(props: { via: 'cmd_k' | 'pull_down' | 'route' }): void {
  track('search_opened', props);
}

export function trackSearchResultPicked(props: { rank: number; query_length: number }): void {
  track('search_result_picked', props);
}

// ── Native chrome ──────────────────────────────────────────────────────

export function trackCommandRan(props: {
  button: 'main' | 'back' | 'settings';
  screen: ScreenName;
}): void {
  track('command_ran', props);
}
