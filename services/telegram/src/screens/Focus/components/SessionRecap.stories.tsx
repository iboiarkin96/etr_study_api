/**
 * Storybook stories for SessionRecap (Focus completion debrief).
 *
 * The ledger of cards missed this session — each row carries the ink of
 * the grade that produced it (danger = Again, warn = Hard), opens the
 * MissSheet composer on tap, and cools to success once the note saves.
 * The stubbed POST succeeds, so the full tap → note → «Noted» loop is
 * playable live in the story.
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType, ReactNode } from 'react';
import { useMemo } from 'react';

import { AuthContext, type AuthContextValue } from '../../../app/auth-context';
import type { SessionMiss } from '../hooks/useFocusSession';
import { SessionRecap } from './SessionRecap';

function makeAuth(): AuthContextValue {
  return {
    status: 'authenticated',
    jwt: 'stub',
    user: { client_uuid: 'client', telegram_user_id: 42 } as AuthContextValue['user'],
    error: null,
    retry: () => {},
    api: {
      GET: async () => ({ data: [], error: undefined }),
      POST: async (_path: string, opts: { body?: { message?: string; conspectus_uuid?: string } }) => ({
        data: {
          error_uuid: `err-${Math.random().toString(36).slice(2, 8)}`,
          message: opts.body?.message ?? '',
          conspectus_uuid: opts.body?.conspectus_uuid ?? null,
          review_log_id: null,
          created_at: new Date().toISOString(),
        },
        error: undefined,
      }),
      PUT: async () => ({ data: undefined, error: undefined }),
      PATCH: async () => ({ data: undefined, error: undefined }),
      DELETE: async () => ({ data: undefined, error: undefined }),
    } as unknown as AuthContextValue['api'],
  };
}

function Providers({ children }: { children: ReactNode }) {
  const qc = useMemo(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
    [],
  );
  return (
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={makeAuth()}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
}

function miss(uuid: string, title: string | null, grade: SessionMiss['grade']): SessionMiss {
  return { conspectus_uuid: uuid, title, grade };
}

const meta = {
  title: 'Screens/Focus/SessionRecap',
  component: SessionRecap,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'End-of-session debrief on the Focus complete state. One row per missed card, grade-toned; tap opens the MissSheet pre-linked to that conspectus. Saved rows lock as «Noted». Renders nothing on a clean sweep.',
      },
    },
  },
  decorators: [
    (Story: ComponentType) => (
      <Providers>
        <div
          className="tma-scope"
          data-density="regular"
          style={{
            background: 'var(--tma-surface-canvas)',
            color: 'var(--tma-text-primary)',
            padding: 24,
            maxWidth: 480,
            minHeight: 320,
          }}
        >
          <Story />
        </div>
      </Providers>
    ),
  ],
} satisfies Meta<typeof SessionRecap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoMisses: Story = {
  args: {
    misses: [
      miss('c-1', 'CAP theorem — what CP actually gives up', 'again'),
      miss('c-2', 'Docker image layers vs. container writable layer', 'hard'),
    ],
  },
};

export const SingleMiss: Story = {
  args: {
    misses: [miss('c-1', 'Idempotency keys in POST /errors', 'hard')],
  },
};

export const LongTitlesAndUntitled: Story = {
  args: {
    misses: [
      miss(
        'c-1',
        'Exactly-once delivery semantics in Kafka: producer idempotence, transactions, and why the consumer side still matters',
        'again',
      ),
      miss('c-2', null, 'hard'),
      miss('c-3', 'gRPC deadlines vs. timeouts', 'again'),
    ],
  },
};

/** Clean sweep renders null — kept for regression coverage: any non-null
 * render on zero misses is a bug (silence, like MissPeek). */
export const CleanSweep: Story = {
  args: { misses: [] },
};
