/**
 * Stories for the raw `.tma-orb-ring` primitive — showcases the three
 * canonical progress states independent of any consumer. Used by the UI
 * Kit components page (`services/portal/ui-kit/pages/telegram-mini-app/
 * components.html` → §Session ring) as its live source; drop the hardcoded
 * inline mocks there in favour of these iframes.
 *
 * The primitive itself is just markup + CSS (`styles/primitives/orb-ring.css`) —
 * no React component wraps it in production yet, since only
 * SessionCompleteOrb composes it. If a mid-session progress ring becomes
 * a real consumer (e.g. Focus header switches from dot-strip to arc),
 * extract a real `<OrbRing>` component and reference it here.
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties, ReactNode } from 'react';

/** Thin display wrapper — pure markup, no logic. Not exported from the
 * component tree; lives here solely so Storybook has something to render. */
function OrbRingDemo({
  progress,
  scenario,
  orbState = 'warm',
  num,
  cap,
  caption,
}: {
  progress: number;
  scenario?: 'celebrate' | 'solid' | 'rough';
  orbState?: 'warm' | 'rested' | 'celebrate';
  num: ReactNode;
  cap: string;
  caption: string;
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        className="tma-orb-ring"
        data-scenario={scenario}
        style={{ ['--ring-progress' as string]: progress } as CSSProperties}
      >
        <div className="tma-orb tma-orb--sm" data-state={orbState}>
          <span className="tma-orb__sheen" aria-hidden="true" />
          <span className="tma-orb__glare" aria-hidden="true" />
          <span className="tma-orb__num">{num}</span>
          <span className="tma-orb__cap">{cap}</span>
        </div>
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--tma-text-tertiary)' }}>{caption}</div>
    </div>
  );
}

const meta = {
  title: 'Kit/OrbRing',
  component: OrbRingDemo,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Session-progress conic arc around the streak orb. Driven by `--ring-progress` (0..1, `@property`-registered so the sweep animates). Ink defaults to ember; `data-scenario` on the wrapper flips to sage (celebrate) or warn (rough). Kit primitive lives at `services/telegram/src/styles/primitives/orb-ring.css`; the only consumer today is `SessionCompleteOrb`. Consumers of the mid-session variant (arc filling one increment per graded card) are pending.',
      },
    },
    router: false,
  },
} satisfies Meta<typeof OrbRingDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Mid-session — 7 of 20 cards graded, ~35 % arc, orb warm. */
export const MidSession: Story = {
  args: {
    progress: 0.35,
    orbState: 'warm',
    num: 7,
    cap: 'of 20',
    caption: 'mid-session · 7 / 20',
  },
};

/** Closing in — 17 of 20 cards graded, ~85 % arc, orb warm. */
export const ClosingIn: Story = {
  args: {
    progress: 0.85,
    orbState: 'warm',
    num: 17,
    cap: 'of 20',
    caption: 'closing in · 17 / 20',
  },
};

/** Complete — full ring, sage ink via `data-scenario="celebrate"`, checkmark
 * inside the orb instead of a numeric count. */
export const Complete: Story = {
  args: {
    progress: 1,
    scenario: 'celebrate',
    orbState: 'rested',
    num: (
      <svg
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ display: 'grid', placeItems: 'center', fontSize: 36 }}
      >
        <path d="M5 12l5 5 9-11" />
      </svg>
    ),
    cap: 'done',
    caption: 'complete · ring turns sage',
  },
};
