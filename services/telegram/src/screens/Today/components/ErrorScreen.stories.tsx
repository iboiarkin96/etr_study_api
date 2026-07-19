import type { Meta, StoryObj } from '@storybook/react-vite';

import { ErrorScreen } from './ErrorScreen';

const meta = {
  title: 'Errors/ErrorScreen',
  component: ErrorScreen,
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: "Full-screen blocking error — broken-orb + one retry CTA. Docs: reference/components/error-screen.html · reference/screens/auth-error.html." } },
  },
  args: { onRetry: () => window.alert('Retrying…') },
} satisfies Meta<typeof ErrorScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Server unreachable — the friendliest of the three. Ask to re-open. */
export const Unreachable: Story = {
  args: {
    title: 'Something is off',
    body: "We couldn't reach the server. Try opening the mini-app again.",
    ctaLabel: 'Try again',
  },
};

/** Server said no — token expired, bad initData, etc. */
export const Denied: Story = {
  args: {
    title: "We couldn't verify your session",
    body: 'Please close and re-open the mini-app so Telegram can sign you in again.',
    ctaLabel: 'Try again',
  },
};

/** Generic — used for any auth error that doesn't match the two above. */
export const Generic: Story = {
  args: {
    title: 'Authorization failed',
    body: 'Please close and re-open the mini-app.',
    ctaLabel: 'Try again',
  },
};
