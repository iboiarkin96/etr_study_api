import type { Meta, StoryObj } from '@storybook/react-vite';

import { YesterdayDigest } from './YesterdayDigest';

const meta = {
  title: 'Today/YesterdayDigest',
  component: YesterdayDigest,
  parameters: {
    layout: 'padded',
    docs: { description: { component: "Yesterday digest strip — accuracy tone success/warn/danger. Docs: reference/screens/today.html (pin 3)." } },
  },
} satisfies Meta<typeof YesterdayDigest>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Great day — success tone, accuracy ≥ 80 %. */
export const Success: Story = {
  args: { data: { reviewed: 9, target: 10, accuracy_pct: 92, missed: 1 } },
};

/** Middle-of-the-road — warn tone, 60 ≤ accuracy < 80. */
export const Warn: Story = {
  args: { data: { reviewed: 7, target: 10, accuracy_pct: 72, missed: 3 } },
};

/** Bad day — danger tone, accuracy < 60. */
export const Danger: Story = {
  args: { data: { reviewed: 4, target: 10, accuracy_pct: 40, missed: 6 } },
};

/** Zero reviewed — accuracy resolves to 0 by the same tone rule. */
export const NothingReviewed: Story = {
  args: { data: { reviewed: 0, target: 5, accuracy_pct: 0, missed: 5 } },
};
