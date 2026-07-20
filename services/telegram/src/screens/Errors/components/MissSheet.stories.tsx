/**
 * Storybook stories for MissSheet (T-20 companion component).
 *
 * The composer bottom-sheet in isolation — closed / open / saving /
 * error banner. Wrapped in `.tma-scope` so the kit tokens resolve.
 */

import type { Meta, StoryObj } from '@storybook/react-vite';

import { MissSheet } from './MissSheet';

const meta = {
  title: 'Screens/Errors/MissSheet',
  component: MissSheet,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Bottom-sheet composer for a new miss entry. Scrim + slide-up panel + textarea + Cancel/Save buttons. Escape or scrim tap closes without saving.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div
        className="tma-scope"
        data-density="regular"
        style={{
          minHeight: '100dvh',
          background: 'var(--tma-surface-canvas)',
          color: 'var(--tma-text-primary)',
          position: 'relative',
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MissSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

export const Open: Story = {
  args: { open: true, saving: false, errorText: null, onClose: noop, onSave: noop },
};

export const Saving: Story = {
  args: { open: true, saving: true, errorText: null, onClose: noop, onSave: noop },
};

export const WithError: Story = {
  args: {
    open: true,
    saving: false,
    errorText: "Couldn't save the miss — try again",
    onClose: noop,
    onSave: noop,
  },
};

export const Closed: Story = {
  args: { open: false, saving: false, errorText: null, onClose: noop, onSave: noop },
};
