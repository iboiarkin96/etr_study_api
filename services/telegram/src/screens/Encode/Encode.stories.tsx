/**
 * Encode screen stories — the ETR conspectus authoring surface.
 *
 * Roles:
 *   1. Kit-page iframe target for `pages/telegram-mini-app/encode.html`.
 *   2. Live docs for the three-phase composer (empty / partial / ready /
 *      saving states) so we can eyeball the ribbon dots + MainButton
 *      unlock without spinning up Telegram.
 *
 * Auth mocking mirrors Errors.stories.tsx — WithAuth wraps AuthContext +
 * QueryClientProvider; per-story `api.POST` overrides let us fake network
 * latency for the Saving story.
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType, ReactNode } from 'react';
import { useMemo } from 'react';

import { AuthContext, type AuthContextValue } from '../../app/auth-context';
import type { components } from '../../shared/api/schema';
import { Encode } from './index';

type ConspectusRow = components['schemas']['ConspectusResponse'];

const STUB_ROW: ConspectusRow = {
  conspectus_uuid: 'stub-uuid',
  title: null,
  cue_sheet: {},
  cue_sheet_schema_version: 1,
  dense_paragraph: '',
  bullets: [''],
  content_version: 1,
  slot: 'A',
  slot_d_ladder_index: 0,
  next_review_at: new Date().toISOString(),
  schedule_revision: 1,
  schedule_policy_id: 'v1',
  schedule_policy_version: '1.0.0',
  algorithm_version: 'v1',
  schedule_updated_at: new Date().toISOString(),
  is_row_invalid: 0,
  invalidation_reason_uuid: null,
  invalidated_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

type Behaviour = 'ok' | 'slow' | 'fail';

function makeAuth(behaviour: Behaviour = 'ok'): AuthContextValue {
  return {
    status: 'authenticated',
    jwt: 'stub',
    user: { client_uuid: 'client', telegram_user_id: 42 } as AuthContextValue['user'],
    error: null,
    retry: () => {},
    api: {
      GET: async () => ({ data: undefined, error: undefined }),
      POST: async () => {
        if (behaviour === 'slow') {
          await new Promise((r) => setTimeout(r, 4000));
        }
        if (behaviour === 'fail') {
          return {
            data: undefined,
            error: { detail: { code: 'COMMON_500', message: 'boom' } },
          };
        }
        return { data: STUB_ROW, error: undefined };
      },
      PUT: async () => ({ data: undefined, error: undefined }),
      PATCH: async () => ({ data: undefined, error: undefined }),
      DELETE: async () => ({ data: undefined, error: undefined }),
    } as unknown as AuthContextValue['api'],
  };
}

function WithAuth({ auth, children }: { auth: AuthContextValue; children: ReactNode }) {
  const qc = useMemo(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
    [],
  );
  return (
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Screens/Encode',
  component: Encode,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Encode screen — three-phase ETR conspectus composer. Encode → dense_paragraph, Trigger → cue_sheet, Recall → bullets. Kit page: ui-kit/pages/telegram-mini-app/encode.html.',
      },
    },
  },
} satisfies Meta<typeof Encode>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Fresh screen — all three phases empty; MainButton hidden. */
export const Empty: Story = {
  decorators: [
    (Story: ComponentType) => (
      <WithAuth auth={makeAuth('ok')}>
        <Story />
      </WithAuth>
    ),
  ],
};

/** Only the required fields (dense_paragraph + at least one bullet) are
 *  filled — Trigger phase is empty, ribbon shows 2/3 dots warm. */
export const RequiredOnly: Story = {
  decorators: [
    (Story: ComponentType) => (
      <WithAuth auth={makeAuth('ok')}>
        <Story />
      </WithAuth>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Once dense_paragraph is filled AND at least one bullet is populated the MainButton unlocks. Trigger is optional — the note ships without it, ribbon two dots warm.',
      },
    },
  },
};

/** All three phases populated — ribbon completes and breathes; MainButton
 *  reads «Save encode». Fill the fields to reach this state. */
export const AllThreePhases: Story = {
  decorators: [
    (Story: ComponentType) => (
      <WithAuth auth={makeAuth('ok')}>
        <Story />
      </WithAuth>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Every phase populated — ribbon plays its single-pulse breath, MainButton unlocked. This is the target state for a well-formed ETR note.',
      },
    },
  },
};

/** Save button held in the loading label state (`api.POST` sleeps 4 s). */
export const Saving: Story = {
  decorators: [
    (Story: ComponentType) => (
      <WithAuth auth={makeAuth('slow')}>
        <Story />
      </WithAuth>
    ),
  ],
};

/** Save fails — toast fires; the draft is preserved so the user can retry. */
export const SaveFails: Story = {
  decorators: [
    (Story: ComponentType) => (
      <WithAuth auth={makeAuth('fail')}>
        <Story />
      </WithAuth>
    ),
  ],
};
