/**
 * Fixture data for Storybook + Playwright screenshot tests.
 *
 * A story that renders `<Today />` seeds the TanStack Query cache with
 * these payloads under the same keys the hooks use, so the real hooks
 * resolve their `data` synchronously without a network request. Keeps
 * the story deterministic (same PNG every run) and free of MSW glue.
 *
 * Anchor date is fixed at 2026-07-19 (day of the first ship of T-25b);
 * shifting it would invalidate every screenshot baseline.
 */

import type { components } from '../../shared/api/schema';
import type { DueConspectus } from './hooks/useConspectusesDue';

type HistoryDay = components['schemas']['HistoryDay'];
type MeStats = components['schemas']['MeStatsResponse'];
type MeYesterday = components['schemas']['MeYesterdayResponse'];
type ScheduleSummary = components['schemas']['ScheduleSummaryResponse'];

/** Freeze the calendar so screenshots don't drift when the wall clock moves. */
export const ANCHOR_ISO = '2026-07-19';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Deterministic LCG so every re-run produces the same heat-map cell counts. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

/** 90-day GitHub-style heat-map, front-loaded activity + steady tail. */
export function mockHistory(days = 90, seed = 7): HistoryDay[] {
  const rng = makeRng(seed);
  const anchor = new Date(`${ANCHOR_ISO}T00:00:00Z`).getTime();
  const out: HistoryDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const iso = new Date(anchor - i * DAY_MS).toISOString().slice(0, 10);
    // ~35 % rest days, rest distributed across 4 intensity buckets
    const r = rng();
    const level: 0 | 1 | 2 | 3 | 4 =
      r < 0.35 ? 0 : r < 0.55 ? 1 : r < 0.75 ? 2 : r < 0.92 ? 3 : 4;
    const count = level === 0 ? 0 : level * 3 + Math.floor(rng() * 4);
    out.push({ date: iso, count, intensity: level });
  }
  return out;
}

export const mockMeStats: MeStats = {
  streak: { current_days: 12, longest_days: 21, goal_days: 30 },
  computed_at: `${ANCHOR_ISO}T09:00:00Z`,
};

export const mockMeYesterday: MeYesterday = {
  yesterday: { reviewed: 8, target: 10, accuracy_pct: 82, missed: 2 },
  date: '2026-07-18',
  computed_at: `${ANCHOR_ISO}T09:00:00Z`,
};

export const mockScheduleSummary: ScheduleSummary = {
  by_slot: { A: 3, B: 3, C: 2, D: 2 },
  due_now: 2,
  due_next_24h: 5,
  total: 10,
  computed_at: `${ANCHOR_ISO}T09:00:00Z`,
};

const DUE_TITLES = [
  { title: 'CAP theorem — trade-offs', slot: 'A' as const, offsetMin: -5 },
  { title: 'Kafka partition rebalancing', slot: 'B' as const, offsetMin: 25 },
  { title: 'Redis Streams vs Pub/Sub', slot: 'C' as const, offsetMin: 120 },
  { title: 'Circuit breaker patterns', slot: 'D' as const, offsetMin: 6 * 60 },
  { title: 'BGP route reflectors', slot: 'A' as const, offsetMin: 24 * 60 },
  { title: 'gRPC deadlines & cancellation', slot: 'B' as const, offsetMin: 3 * 24 * 60 },
];

export function mockConspectusesDue(): DueConspectus[] {
  const now = new Date(`${ANCHOR_ISO}T09:00:00Z`).getTime();
  return DUE_TITLES.map(
    (row, i) =>
      ({
        conspectus_uuid: `00000000-0000-4000-8000-0000000000${(i + 1).toString().padStart(2, '0')}`,
        title: row.title,
        slot: row.slot,
        next_review_at: new Date(now + row.offsetMin * 60_000).toISOString(),
      }) as DueConspectus,
  );
}

export const MOCK_USER = {
  client_uuid: '00000000-0000-4000-8000-000000000000',
  telegram_user_id: 111_222_333,
  telegram_username: 'demo',
  telegram_photo_url: null,
  locale: 'ru',
  full_name: 'Demo User',
};
