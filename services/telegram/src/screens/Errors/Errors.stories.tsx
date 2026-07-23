/**
 * Storybook stories for the Errors screen (T-20).
 *
 * Amie signature variant — MissOrb (weekly count) · list header · rows
 * · «Log a miss» CTA · MissSheet composer. Same auth+cache mocking
 * pattern as Schedule.stories.tsx (WithAuth decorator wraps AuthContext
 * + QueryClientProvider; per-story fixtures for list payload).
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType, ReactNode } from 'react';
import { useMemo } from 'react';

import { AuthContext, type AuthContextValue } from '../../app/auth-context';
import type { components } from '../../shared/api/schema';
import { Errors } from './index';

type LearningError = components['schemas']['ErrorLogResponse'];

function makeAuth(overrides: { list?: LearningError[] } = {}): AuthContextValue {
  const list = overrides.list ?? [];
  return {
    status: 'authenticated',
    jwt: 'stub',
    user: { client_uuid: 'client', telegram_user_id: 42 } as AuthContextValue['user'],
    error: null,
    retry: () => {},
    api: {
      GET: async (path: string) => {
        if (path === '/api/v1/errors') return { data: list, error: undefined };
        return { data: undefined, error: undefined };
      },
      POST: async () => ({
        data: {
          error_uuid: `srv-${Math.random().toString(36).slice(2, 8)}`,
          message: 'Stub miss',
          conspectus_uuid: null,
          review_log_id: null,
          created_at: new Date().toISOString(),
        } as LearningError,
        error: undefined,
      }),
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
  title: 'Screens/Errors',
  component: Errors,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Errors screen (T-20). Append-only miss log — MissOrb hero + timeline rows + «Log a miss» primary CTA. Docs: reference/screens/errors.html.',
      },
    },
  },
} satisfies Meta<typeof Errors>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Row created N days ago at HH:MM. */
function row(daysAgo: number, hh: number, mm: number, message: string): LearningError {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hh, mm, 0, 0);
  return {
    error_uuid: `err-${daysAgo}-${hh}${mm}`,
    message,
    conspectus_uuid: null,
    review_log_id: null,
    created_at: d.toISOString(),
  };
}

const POPULATED: LearningError[] = [
  row(0, 9, 12, 'Confused eventual with strong consistency (CAP)'),
  row(1, 21, 4, 'SRP mixed up with SoC while explaining to a junior'),
  row(3, 8, 30, 'Answered C and A but forgot the P entirely (CAP)'),
];

export const Populated: Story = {
  decorators: [
    (Story: ComponentType) => (
      <WithAuth auth={makeAuth({ list: POPULATED })}>
        <Story />
      </WithAuth>
    ),
  ],
};

export const Empty: Story = {
  decorators: [
    (Story: ComponentType) => (
      <WithAuth auth={makeAuth({ list: [] })}>
        <Story />
      </WithAuth>
    ),
  ],
};

export const SingleEntry: Story = {
  decorators: [
    (Story: ComponentType) => (
      <WithAuth auth={makeAuth({ list: [row(0, 14, 22, 'One miss, noticed on purpose')] })}>
        <Story />
      </WithAuth>
    ),
  ],
};

export const LoadError: Story = {
  decorators: [
    (Story: ComponentType) => {
      const errAuth: AuthContextValue = {
        ...makeAuth({}),
        api: {
          GET: async () => ({
            data: undefined,
            error: { detail: { code: 'COMMON_500', message: 'db down' } },
          }),
          POST: async () => ({ data: undefined, error: undefined }),
          PUT: async () => ({ data: undefined, error: undefined }),
          PATCH: async () => ({ data: undefined, error: undefined }),
          DELETE: async () => ({ data: undefined, error: undefined }),
        } as unknown as AuthContextValue['api'],
      };
      return (
        <WithAuth auth={errAuth}>
          <Story />
        </WithAuth>
      );
    },
  ],
};
