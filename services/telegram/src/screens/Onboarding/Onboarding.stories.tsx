/**
 * Storybook stories for the Onboarding screen (T-24).
 *
 * Amie signature («Living hello»): day-zero orb hero + headline + three
 * ETR moves + primary CTA + quiet skip ghost. Two stories:
 *
 *   Default — the surface as a first-time user sees it.
 *   Compact — the same tree in a 640 px scroll wrapper. Guards visual
 *             snapshots against layout regressions when the skip ghost or
 *             foot-note would otherwise crop on a short viewport.
 *
 * The screen doesn't hit any auth-gated endpoint, so no AuthContext is
 * needed; it just consumes the local `useOnboardingSeen` flag which is
 * inert under Storybook (writes to localStorage, `cloudGet` no-ops
 * because `window.Telegram` is absent).
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentType } from 'react';

import { Onboarding } from './index';

const meta = {
  title: 'Screens/Onboarding',
  component: Onboarding,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The first-run flow (T-24, Amie signature «Living hello»). Day-zero orb hero, three E · T · R moves as the editorial peek, one primary CTA. The dismissed flag persists in Telegram CloudStorage with a localStorage mirror so a page reload never re-shows it.',
      },
    },
  },
} satisfies Meta<typeof Onboarding>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The surface as a fresh cold open lands on it — nothing to hydrate. */
export const Default: Story = {};

/** Same tree with a scroll wrapper — snapshot diffs across viewport heights
 *  never crop the skip ghost + foot note. */
export const Compact: Story = {
  decorators: [
    (StoryComp: ComponentType) => (
      <div style={{ maxHeight: '640px', overflow: 'auto' }}>
        <StoryComp />
      </div>
    ),
  ],
};
