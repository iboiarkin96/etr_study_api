/**
 * Storybook stories for MissPeek (T-20a).
 *
 * The quiet 1-line pill Today renders under YesterdayDigest when at least
 * one miss has been logged in the last 7 days. Stories mock the shared
 * `useErrors` cache directly (per-story QueryClient seed).
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType, ReactNode } from 'react';
import { useMemo } from 'react';

import { AuthContext, type AuthContextValue } from '../../../app/auth-context';
import type { components } from '../../../shared/api/schema';
import { MissPeek } from './MissPeek';

type LearningError = components['schemas']['ErrorLogResponse'];

function makeAuth(): AuthContextValue {
  return {
    status: 'authenticated',
    jwt: 'stub',
    user: { client_uuid: 'client', telegram_user_id: 42 } as AuthContextValue['user'],
    error: null,
    retry: () => {},
    api: {
      GET: async () => ({ data: [] as LearningError[], error: undefined }),
      POST: async () => ({ data: undefined, error: undefined }),
      PUT: async () => ({ data: undefined, error: undefined }),
      PATCH: async () => ({ data: undefined, error: undefined }),
      DELETE: async () => ({ data: undefined, error: undefined }),
    } as unknown as AuthContextValue['api'],
  };
}

function row(daysAgo: number, message: string): LearningError {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    error_uuid: `err-${daysAgo}`,
    message,
    conspectus_uuid: null,
    review_log_id: null,
    created_at: d.toISOString(),
  };
}

function WithSeed({ list, children }: { list: LearningError[]; children: ReactNode }) {
  const qc = useMemo(() => {
    const c = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    c.setQueryData(['errors.list', 'client'], list);
    return c;
  }, [list]);
  return (
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={makeAuth()}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Today/MissPeek',
  component: MissPeek,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Quiet 1-line pill under YesterdayDigest. Renders only when weekly count > 0 — silence on empty is intentional (D3 «peek, not chrome»).',
      },
    },
  },
  decorators: [
    (Story: ComponentType) => (
      <div className="tma-scope" data-density="regular" style={{ background: 'var(--tma-surface-canvas)', padding: 24, maxWidth: 400 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MissPeek>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  decorators: [
    (Story: ComponentType) => (
      <WithSeed list={[row(0, 'CAP'), row(1, 'SOLID'), row(2, 'Kafka')]}>
        <Story />
      </WithSeed>
    ),
  ],
};

export const SingleMiss: Story = {
  decorators: [
    (Story: ComponentType) => (
      <WithSeed list={[row(0, 'CAP')]}>
        <Story />
      </WithSeed>
    ),
  ],
};

/** Empty renders null — visible as an empty box in Storybook. Kept as a story
 * for regression coverage: any non-null render on zero-state is a bug. */
export const Empty: Story = {
  decorators: [
    (Story: ComponentType) => (
      <WithSeed list={[]}>
        <Story />
      </WithSeed>
    ),
  ],
};
