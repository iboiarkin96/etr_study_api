/**
 * Full-screen Today story — the canonical «what the launch screen looks
 * like» reference. Two roles:
 *
 *   1. Portal kit + reference iframe target (T-33, T-37 in the plan).
 *      A kit-page phone-mock loads `iframe.html?id=screens-today--default`
 *      instead of hand-authoring HTML markup.
 *   2. Storybook Docs page for the composed screen — one place to browse
 *      the block layout, breakpoints, and copy simultaneously.
 *
 * Data is seeded into TanStack Query's cache under the same keys the
 * production hooks use, so the real components render off the fixtures
 * without touching the network. Auth is provided by a fake context
 * value with `status: 'authenticated'`, mimicking a signed-in user.
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo } from 'react';

import { AuthContext, type AuthContextValue } from '../../app/auth-context';
import type { ApiClient } from '../../shared/api/client';

import { Today } from './index';
import {
  MOCK_USER,
  mockConspectusesDue,
  mockHistory,
  mockMeStats,
  mockMeYesterday,
  mockScheduleSummary,
} from './Today.mocks';

/** Placeholder API client — the story path never calls it (query cache
 *  is pre-seeded), but the context expects a non-null value. */
const NOOP_API = {} as unknown as ApiClient;

function TodayHost() {
  const client = useMemo(() => {
    const c = new QueryClient({
      defaultOptions: {
        queries: {
          // Never refetch — the cache is the source of truth for stories.
          staleTime: Infinity,
          gcTime: Infinity,
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });
    c.setQueryData(['today.conspectuses.due', MOCK_USER.client_uuid], mockConspectusesDue());
    c.setQueryData(['today.schedule.summary', MOCK_USER.client_uuid], mockScheduleSummary);
    c.setQueryData(['me.stats', MOCK_USER.client_uuid], mockMeStats);
    c.setQueryData(['me.yesterday', MOCK_USER.client_uuid], mockMeYesterday);
    c.setQueryData(['schedule.history', MOCK_USER.client_uuid, 90], {
      days: mockHistory(90),
      computed_at: `2026-07-19T09:00:00Z`,
    });
    return c;
  }, []);

  const auth = useMemo<AuthContextValue>(
    () => ({
      status: 'authenticated',
      jwt: 'story-jwt',
      user: MOCK_USER,
      error: null,
      api: NOOP_API,
      retry: () => undefined,
    }),
    [],
  );

  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <Today />
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Screens/Today',
  component: TodayHost,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The canonical launch screen — Streak orb, Yesterday digest, ' +
          'Schedule summary strip, Due cards list, 90-day heat-map, ' +
          'Recently reviewed peek. Fixtures are frozen to 2026-07-19 so ' +
          'the screenshot is byte-stable across runs.',
      },
    },
  },
} satisfies Meta<typeof TodayHost>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every block populated · 12-day streak · 2 due now, 5 in the next 24 h. */
export const Default: Story = {};
