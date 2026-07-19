/**
 * Mocked data hook for T-15's four hero blocks.
 *
 * Streak, yesterday digest and heat-map depend on API endpoints marked
 * «new» on `services/portal/ui-kit/pages/telegram-mini-app/today.html`:
 *
 *   * `GET /api/v1/me/stats`         → streak
 *   * `GET /api/v1/me/yesterday`     → digest strip
 *   * `GET /api/v1/schedule/history` → 90-day heat-map
 *
 * None of the three exist on the API yet (they land in W3 backend follow-up).
 * Rather than block T-15's UI on backend work, this hook returns
 * deterministic mock data keyed on today's date so the visual layer can
 * ship, get design-review, and swap onto the real endpoints later without
 * touching any consumer. Every consumer file has a matching TODO comment
 * pointing back here.
 *
 * Recently-reviewed is derived from `useConspectusesDue` — the same list
 * cut to the last five items — until `/conspectuses?sort=-last_reviewed_at`
 * gets a dedicated hook. That keeps this file self-contained.
 */

import { useMemo } from 'react';

import { useConspectusesDue, type DueConspectus } from './useConspectusesDue';

export type YesterdayDigest = {
  reviewed: number;
  target: number;
  accuracyPct: number;
};

export type StreakStats = {
  currentDays: number;
  longestDays: number;
  goalDays: number;
};

export type HeatmapDay = {
  isoDate: string;
  intensity: 0 | 1 | 2 | 3 | 4;
  count: number;
};

export type DailyStats = {
  yesterday: YesterdayDigest;
  streak: StreakStats;
  heatmap: HeatmapDay[];
  recentlyReviewed: DueConspectus[];
  isMock: true;
};

/**
 * Deterministic pseudo-random in [0, 1) seeded by a positive integer.
 * xorshift32 — one line, no dependency, stable across reloads for the
 * same date so the mock heat-map doesn't flicker between renders.
 */
function xorshift(seed: number): () => number {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10_000) / 10_000;
  };
}

function seedFromDate(d: Date): number {
  return d.getUTCFullYear() * 10_000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function buildMockHeatmap(days: number): HeatmapDay[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const rand = xorshift(seedFromDate(today));
  const rows: HeatmapDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const r = rand();
    let count: number;
    if (r < 0.35) count = 0;
    else if (r < 0.55) count = 1 + Math.floor(rand() * 3);
    else if (r < 0.85) count = 4 + Math.floor(rand() * 6);
    else count = 10 + Math.floor(rand() * 15);
    const intensity = ((count === 0
      ? 0
      : count < 3
        ? 1
        : count < 7
          ? 2
          : count < 12
            ? 3
            : 4) as HeatmapDay['intensity']);
    rows.push({ isoDate: d.toISOString().slice(0, 10), intensity, count });
  }
  return rows;
}

export function useDailyStats(): DailyStats {
  const due = useConspectusesDue();

  const heatmap = useMemo(() => buildMockHeatmap(90), []);

  const yesterday: YesterdayDigest = useMemo(
    () => ({ reviewed: 8, target: 10, accuracyPct: 87 }),
    [],
  );
  const streak: StreakStats = useMemo(
    () => ({ currentDays: 12, longestDays: 21, goalDays: 30 }),
    [],
  );

  const recentlyReviewed = useMemo(
    () => (due.data ?? []).slice(0, 5),
    [due.data],
  );

  return { yesterday, streak, heatmap, recentlyReviewed, isMock: true };
}
