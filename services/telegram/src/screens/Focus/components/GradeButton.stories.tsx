import type { Meta, StoryObj } from '@storybook/react-vite';

import { GradeButton } from './GradeButton';
import { GRADES } from './grade-spec';

const meta = {
  title: 'Focus/GradeButton',
  component: GradeButton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One of four SM-2 grade buttons in the Focus review flow. Grade + label + tone + hotkey are pinned by the shared `GRADES` array so a story cannot paint an Easy button warn-tinted. Docs: reference/components/grade-button.html.',
      },
    },
    router: false,
  },
  args: {
    onPress: (g: string) => console.info('[GradeButton] press', g),
    disabled: false,
    showHotkey: true,
  },
} satisfies Meta<typeof GradeButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Again: Story = {
  args: { spec: GRADES[0], label: 'Again' },
};

export const Hard: Story = {
  args: { spec: GRADES[1], label: 'Hard' },
};

export const Good: Story = {
  args: { spec: GRADES[2], label: 'Good' },
};

export const Easy: Story = {
  args: { spec: GRADES[3], label: 'Easy' },
};

export const Disabled: Story = {
  args: { spec: GRADES[2], label: 'Good', disabled: true },
};
