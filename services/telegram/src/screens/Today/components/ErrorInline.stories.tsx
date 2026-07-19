import type { Meta, StoryObj } from '@storybook/react-vite';

import { ErrorInline } from './ErrorInline';

const meta = {
  title: 'Errors/ErrorInline',
  component: ErrorInline,
  parameters: {
    layout: 'padded',
    docs: { description: { component: "Single-block inline error with retry — used on stats / yesterday / history regions. Docs: reference/screens/today.html (alternate states)." } },
  },
  args: { onRetry: () => window.alert('Retrying block…') },
} satisfies Meta<typeof ErrorInline>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Streak block failed to load. */
export const Streak: Story = {
  args: { label: "Couldn't load streak" },
};

/** Yesterday digest failed to load. */
export const Yesterday: Story = {
  args: { label: "Couldn't load yesterday" },
};

/** 90-day heat-map failed to load. */
export const History: Story = {
  args: { label: "Couldn't load history" },
};
