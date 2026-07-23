/**
 * Storybook stories for the Focus screen (T-18).
 *
 * Auth + due-list are mocked via a wrapper that seeds the query cache with
 * a fixture and stubs `useReviewConspectus` behaviour through a POST mock
 * that returns a fake `next_review_at`. Stories cover the three visually
 * distinct in-session phases plus the two end states.
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType, ReactNode } from 'react';
import { useMemo } from 'react';

import { AuthContext, type AuthContextValue } from '../../app/auth-context';
import type { DueConspectus } from '../Today/hooks/useConspectusesDue';
import { Focus } from './index';

function makeAuth(overrides: {
  due?: Partial<DueConspectus>[];
  postFails?: boolean;
} = {}): AuthContextValue {
  const items = overrides.due ?? [];
  return {
    status: 'authenticated',
    jwt: 'stub',
    user: { client_uuid: 'client', telegram_user_id: 42 } as AuthContextValue['user'],
    error: null,
    retry: () => {},
    api: {
      GET: async () => ({ data: items as DueConspectus[], error: undefined }),
      POST: async () =>
        overrides.postFails
          ? { data: undefined, error: { detail: { code: '500', message: 'boom' } } as unknown as never }
          : { data: { conspectus_uuid: 'x', next_review_at: '2026-07-25T09:00:00Z' }, error: undefined },
      PUT: async () => ({ data: undefined, error: undefined }),
      PATCH: async () => ({ data: undefined, error: undefined }),
      DELETE: async () => ({ data: undefined, error: undefined }),
    } as unknown as AuthContextValue['api'],
  };
}

function WithAuth({ auth, children }: { auth: AuthContextValue; children: ReactNode }) {
  const qc = useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }), []);
  return (
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Screens/Focus',
  component: Focus,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Focus SRS review flow (T-18). Full-screen chrome-free surface — session progress + card + grade strip. Docs: reference/screens/focus.html.',
      },
    },
  },
} satisfies Meta<typeof Focus>;

export default meta;
type Story = StoryObj<typeof meta>;

const cards = (n: number): Partial<DueConspectus>[] =>
  Array.from({ length: n }, (_, i) => ({
    conspectus_uuid: `demo-${i}`,
    title: [
      'CAP theorem — the trade-off in one sentence',
      'What does SRP actually mean by «reason to change»?',
      'Kafka rebalancing under partition addition',
      'Circuit breaker — half-open state semantics',
    ][i % 4],
    dense_paragraph:
      'Consistency and availability cannot both be guaranteed in the presence of a network partition. Pick two of three; the network is always the odd one out.',
    bullets: [
      'Netflix chose availability over strong consistency for the play catalog',
      'Bank ledgers pick consistency — stale reads worse than a spinner',
      'Choose per data type, not per service',
    ],
    slot: 'A',
    schedule_revision: 1,
    next_review_at: new Date(Date.now() + i * 30 * 60_000).toISOString(),
  } as Partial<DueConspectus>));

export const Prompt: Story = {
  decorators: [
    (Story: ComponentType) => (
      <WithAuth auth={makeAuth({ due: cards(4) })}>
        <Story />
      </WithAuth>
    ),
  ],
};

export const Empty: Story = {
  decorators: [
    (Story: ComponentType) => (
      <WithAuth auth={makeAuth({ due: [] })}>
        <Story />
      </WithAuth>
    ),
  ],
};
