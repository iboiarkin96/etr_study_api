/**
 * Three stories per scenario the resolver picks (celebrate / solid / rough)
 * plus a zero-graded defensive story. Each seeds `perGrade` directly so
 * the ring's fill matches the accuracy the label announces — a design
 * regression on either side would show up as a numeric-vs-visual mismatch
 * in the pixel diff.
 */

import type { Meta, StoryObj } from '@storybook/react-vite';

import type { SessionSummary } from '../hooks/useFocusSession';
import { SessionCompleteOrb } from './SessionCompleteOrb';

function summary(over: Partial<SessionSummary['perGrade']> & { elapsedMs?: number } = {}): SessionSummary {
  const perGrade = { again: 0, hard: 0, good: 0, easy: 0, ...over };
  const graded = perGrade.again + perGrade.hard + perGrade.good + perGrade.easy;
  return {
    graded,
    perGrade,
    perTag: {
      easy: perGrade.easy,
      hard: perGrade.hard + perGrade.good,
      forgot: perGrade.again,
    },
    elapsedMs: over.elapsedMs ?? 45_000,
  };
}

const meta = {
  title: 'Focus/SessionCompleteOrb',
  component: SessionCompleteOrb,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Ring-around-orb visual on the Focus session-complete screen. Accuracy = (easy + good) / graded fills a conic arc around the streak orb; scenario (celebrate / solid / rough) picks the ring ink and orb state so the outcome reads before the copy. See reference/components/orb-ring… (kit primitive lives at `services/telegram/src/styles/primitives/orb-ring.css`).',
      },
    },
    router: false,
  },
} satisfies Meta<typeof SessionCompleteOrb>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Clean sweep — accuracy 100 %, no Again. Sage full ring, orb celebrate-pulse. */
export const Celebrate: Story = {
  args: { summary: summary({ easy: 4, good: 3 }) },
};

/** Mixed but solid — 5/7 correct (~71 %). Ember ~71 % arc, orb warm. */
export const Solid: Story = {
  args: { summary: summary({ easy: 2, good: 3, hard: 2 }) },
};

/** Rough — 2/7 correct (~29 %). Warn arc, orb still warm (the ring carries the signal, not the orb tint). */
export const Rough: Story = {
  args: { summary: summary({ easy: 1, good: 1, hard: 2, again: 3 }) },
};

/** Rough via Again-share — accuracy is OK (60 %) but too many Agains (40 %). */
export const RoughByAgains: Story = {
  args: { summary: summary({ easy: 2, good: 1, again: 2 }) },
};

/** Defensive: graded=0 shouldn't render in production (complete phase gates on it), but the resolver should still return a sane scenario. */
export const Empty: Story = {
  args: { summary: summary() },
};
