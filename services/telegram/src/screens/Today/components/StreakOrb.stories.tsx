import type { Meta, StoryObj } from '@storybook/react-vite';

import { StreakOrb } from './StreakOrb';

const meta = {
  title: 'Today/StreakOrb',
  component: StreakOrb,
  parameters: {
    layout: 'centered',
    docs: { description: { component: "The D1 breathing element of Today. Docs: reference/components/streak-orb.html · design decision: ADR 0038 (D1, D4)." } },
  },
  argTypes: {
    dueToday: { control: { type: 'number', min: 0, max: 10 } },
    size: { control: 'radio', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<typeof StreakOrb>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Warm — default habit day. Streak alive, work still due. */
export const Warm: Story = {
  args: {
    data: { current_days: 12, longest_days: 21, goal_days: 30 },
    dueToday: 4,
    size: 'lg',
  },
};

/** Rested — sage twin. Streak alive but nothing due today. */
export const Rested: Story = {
  args: {
    data: { current_days: 12, longest_days: 21, goal_days: 30 },
    dueToday: 0,
    size: 'lg',
  },
};

/** Celebrate — milestone. Every 30-day streak. Beats rested. */
export const Celebrate: Story = {
  args: {
    data: { current_days: 30, longest_days: 30, goal_days: 30 },
    dueToday: 4,
    size: 'lg',
  },
};

/** Small — used inside EmptyToday next to «All caught up». */
export const Small: Story = {
  args: {
    data: { current_days: 7, longest_days: 21, goal_days: 30 },
    dueToday: 0,
    size: 'sm',
  },
};

/** Milestone-on-zero — celebrates even when nothing is due. */
export const MilestoneOverridesRested: Story = {
  args: {
    data: { current_days: 60, longest_days: 60, goal_days: 30 },
    dueToday: 0,
    size: 'lg',
  },
};
