import type { Meta, StoryObj } from '@storybook/react-vite';

import { ScheduleSummaryStrip } from './ScheduleSummaryStrip';

const meta = {
  title: 'Today/ScheduleSummaryStrip',
  component: ScheduleSummaryStrip,
  parameters: {
    layout: 'padded',
    docs: { description: { component: "Due-now / next-24h / total counters. Docs: reference/screens/today.html (pin 4)." } },
  },
} satisfies Meta<typeof ScheduleSummaryStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

const base = {
  by_slot: { A: 3, B: 3, C: 2, D: 2 },
  computed_at: '2026-07-19T09:00:00Z',
};

/** A typical morning — 2 due now, 5 next 24 h, 10 total. */
export const Typical: Story = {
  args: { data: { ...base, due_now: 2, due_next_24h: 5, total: 10 } },
};

/** Nothing due — «rested» adjacent day. */
export const Empty: Story = {
  args: {
    data: { by_slot: { A: 0, B: 0, C: 0, D: 0 }, due_now: 0, due_next_24h: 0, total: 0, computed_at: base.computed_at },
  },
};

/** Overloaded day — power learner catching up. */
export const Overloaded: Story = {
  args: {
    data: {
      by_slot: { A: 12, B: 8, C: 4, D: 1 },
      due_now: 15,
      due_next_24h: 24,
      total: 25,
      computed_at: base.computed_at,
    },
  },
};
