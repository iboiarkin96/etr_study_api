import type { Meta, StoryObj } from '@storybook/react-vite';

import { HeatmapCalendar } from './HeatmapCalendar';

type Day = { date: string; count: number; intensity: 0 | 1 | 2 | 3 | 4 };

/** Fixed anchor date so the heat-map layout is deterministic across runs. */
const ANCHOR = new Date('2026-07-19T00:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function iso(days_ago: number): string {
  return new Date(ANCHOR.getTime() - days_ago * DAY_MS).toISOString().slice(0, 10);
}

function pick(rng: () => number, weights: number[]): number {
  const r = rng();
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (r < acc) return i;
  }
  return weights.length - 1;
}

/** Deterministic 90-day series with the caller's intensity distribution. */
function series(weights: number[], seed = 1): Day[] {
  let s = seed;
  const rng = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return ((s >>> 0) / 0x100000000);
  };
  const days: Day[] = [];
  for (let i = 89; i >= 0; i--) {
    const level = pick(rng, weights) as 0 | 1 | 2 | 3 | 4;
    const count = level === 0 ? 0 : level * 3 + Math.floor(rng() * 4);
    days.push({ date: iso(i), count, intensity: level });
  }
  return days;
}

const meta = {
  title: 'Today/HeatmapCalendar',
  component: HeatmapCalendar,
  parameters: {
    layout: 'padded',
    docs: { description: { component: "90-day GitHub-style review heat-map. Docs: reference/screens/today.html (pins 8–9)." } },
  },
} satisfies Meta<typeof HeatmapCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Mixed intensities — a habit alive-and-well pattern. */
export const Populated: Story = {
  args: { data: series([0.25, 0.15, 0.2, 0.25, 0.15], 7) },
};

/** Every day 0 count — brand-new user or a long dark stretch. */
export const Empty: Story = {
  args: { data: series([1, 0, 0, 0, 0], 3) },
};

/** Almost all days lit — power-user grind mode. */
export const HighDensity: Story = {
  args: { data: series([0.02, 0.08, 0.2, 0.35, 0.35], 42) },
};
