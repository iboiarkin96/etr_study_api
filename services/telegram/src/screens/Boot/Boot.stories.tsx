/**
 * Storybook stories for BootScreen — the full-viewport splash rendered
 * by <AuthGate> while the cold-open `/api/v1/auth/telegram` handshake
 * is in flight. Isolated here so we can review the ember-orb breath +
 * fade-in choreography without booting the app.
 */

import type { Meta, StoryObj } from '@storybook/react-vite';

import { BootScreen } from '.';

const meta = {
  title: 'Screens/BootScreen',
  component: BootScreen,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Warm ember-orb splash with a 200 ms fade-in delay so a fast handshake ' +
          "(~150 ms) never flashes it. Rendered globally by <AuthGate> while " +
          "`auth.status === 'idle' | 'authenticating'`. See " +
          '`reference/screens/boot.html` for the full anatomy.',
      },
    },
  },
} satisfies Meta<typeof BootScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The default splash — pulse + fade-in run automatically. Reload the
 * story frame to re-play the intro. */
export const Default: Story = {};

/** Explicit reduced-motion variant so reviewers can confirm the CSS
 * degrades cleanly (both keyframe animations collapse to their
 * initial visible state — no motion, but the orb is still visible). */
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Renders with `prefers-reduced-motion: reduce` forced through a ' +
          "`<style>` override so reviewers don't need OS-level settings to " +
          'verify the fallback.',
      },
    },
  },
  decorators: [
    (StoryFn) => (
      <>
        <style>{`
          .tma-boot__inner { animation: none !important; opacity: 1 !important; transform: none !important; }
          .tma-boot__orb::before, .tma-boot__orb::after { animation: none !important; }
        `}</style>
        <StoryFn />
      </>
    ),
  ],
};
