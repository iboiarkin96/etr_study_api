import type { Meta, StoryObj } from '@storybook/react-vite';

import { LangSwitch } from './LangSwitch';

const meta = {
  title: 'Shared/LangSwitch',
  component: LangSwitch,
  parameters: {
    layout: 'centered',
    docs: { description: { component: "EN/RU pill toggle; right-click clears the manual override. Docs: reference/screens/today.html (pin 1)." } },
  },
} satisfies Meta<typeof LangSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default — the resolved language wins the active pill. Toggle via the
 * top-toolbar switch or click a pill; right-click / long-press clears
 * the override.
 */
export const Default: Story = {};
