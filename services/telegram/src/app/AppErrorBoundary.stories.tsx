/**
 * Storybook stories for AppErrorBoundary.
 *
 * We can't render an error boundary's fallback in Storybook by wishing —
 * the boundary only shows its fallback after a child renders and throws.
 * The `Throw` helper below does exactly that: throws once on mount so the
 * boundary catches it and swaps in the ErrorScreen fallback. Storybook
 * logs the caught error to the console (expected, harmless).
 *
 * Rendered here so reviewers can see the fallback anatomy without setting
 * up a broken deploy or hand-editing a screen to throw.
 */

import type { Meta, StoryObj } from '@storybook/react-vite';

import { AppErrorBoundary } from './AppErrorBoundary';

function Throw(): null {
  throw new Error('Storybook demo: this component throws so the boundary shows its fallback.');
}

/** Wrap the boundary here rather than binding Storybook's `component` to
 *  the `withTranslation()` HOC — the HOC's public props include the whole
 *  i18n bag, which forces every Story to declare `args`. That level of
 *  ceremony hides the point of the story. */
function FallbackDemo() {
  return (
    <AppErrorBoundary>
      <Throw />
    </AppErrorBoundary>
  );
}

function HappyDemo() {
  return (
    <AppErrorBoundary>
      <div
        style={{
          padding: 24,
          color: 'var(--tma-text-primary)',
          background: 'var(--tma-surface-canvas)',
          minHeight: '100dvh',
        }}
      >
        <p>
          Nothing to see — this is what the boundary looks like when nothing has
          thrown yet: it's transparent, its children just render.
        </p>
      </div>
    </AppErrorBoundary>
  );
}

const meta: Meta<typeof FallbackDemo> = {
  title: 'Shell/AppErrorBoundary',
  component: FallbackDemo,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Global React error boundary. When any child throws during render / effect, ' +
          "the boundary catches it and swaps in the shared `<ErrorScreen>` fallback — " +
          "the same broken-orb surface the auth handshake uses on failure. " +
          "See `reference/components/app-error-boundary.html`.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

/** The fallback the user sees when a component crashes — broken orb,
 *  title, body, primary «Try again» CTA, and the underlined secondary
 *  «Reload the app» link beneath it. */
export const Fallback: Story = {
  render: () => <FallbackDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'The state the user actually sees. `<Throw>` throws once on mount so the ' +
          'boundary catches and renders the fallback. Storybook logs the caught error ' +
          'to the console — expected and harmless.',
      },
    },
  },
};

/** Happy path — no throw, children render normally. Included so the
 *  «broken vs healthy» comparison is one story-click away. */
export const NoError: Story = {
  render: () => <HappyDemo />,
};
