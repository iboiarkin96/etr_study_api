/**
 * Full-screen ConspectusDetail story — the canonical read-only note view.
 * Serves as the iframe target for the portal screen-map
 * (reference/screens/conspectus-detail.html) and the Docs page for the
 * composed screen.
 *
 * The screen reads its uuid from the route, so the story mounts its own
 * memory router already positioned at `/conspectus/<uuid>` (the global
 * preview router is disabled via `parameters.router: false`). Data is
 * seeded into the TanStack Query cache under the hook's key, so the
 * real `useConspectus` resolves synchronously without a network layer.
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { useMemo } from 'react';

import { AuthContext, type AuthContextValue } from '../../app/auth-context';
import type { ApiClient } from '../../shared/api/client';
import { MOCK_USER } from '../Today/Today.mocks';

import { ConspectusDetail } from './index';

const UUID = '00000000-0000-4000-8000-000000000002';

const MOCK_CONSPECTUS = {
  conspectus_uuid: UUID,
  title: 'Kafka partition rebalancing',
  cue_sheet: {
    version: 1,
    cues: [
      { q: 'What triggers a rebalance?', a: 'Consumer joins/leaves, subscription change, partition count change' },
      { q: 'Which protocol minimises stop-the-world pauses?', a: 'Cooperative sticky (incremental) rebalancing' },
    ],
  },
  cue_sheet_schema_version: 1,
  dense_paragraph:
    'A rebalance redistributes partitions across the consumer group whenever membership or ' +
    'subscription changes. The classic eager protocol revokes every partition first — a ' +
    'stop-the-world pause proportional to group size. Cooperative sticky rebalancing revokes ' +
    'only the partitions that actually move, so a single joining consumer no longer stalls ' +
    'the whole group. Static membership (group.instance.id) avoids rebalances entirely for ' +
    'bounce-restarts within session.timeout.ms.',
  bullets: [
    'Eager protocol: revoke all → reassign all; pause grows with group size',
    'Cooperative sticky: revoke only moving partitions; two-phase, no global pause',
    'Static membership skips the rebalance on clean restarts within the session timeout',
    'max.poll.interval.ms exceeded → consumer evicted → rebalance triggered',
  ],
  content_version: 3,
  slot: 'B',
  slot_d_ladder_index: 0,
  next_review_at: '2026-07-19T12:30:00Z',
  schedule_revision: 4,
  schedule_policy_id: 'etr-default',
  schedule_policy_version: 1,
  created_at: '2026-06-02T10:00:00Z',
  updated_at: '2026-07-18T08:15:00Z',
};

const NOOP_API = {} as unknown as ApiClient;

function DetailHost() {
  const client = useMemo(() => {
    const c = new QueryClient({
      defaultOptions: {
        queries: { staleTime: Infinity, gcTime: Infinity, retry: false, refetchOnWindowFocus: false },
      },
    });
    c.setQueryData(['conspectus.detail', MOCK_USER.client_uuid, UUID], MOCK_CONSPECTUS);
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

  const router = useMemo(() => {
    const root = createRootRoute({ component: () => <Outlet /> });
    const index = createRoute({
      getParentRoute: () => root,
      path: '/',
      component: () => null,
    });
    const detail = createRoute({
      getParentRoute: () => root,
      path: '/conspectus/$conspectus_uuid',
      component: ConspectusDetail,
    });
    return createRouter({
      routeTree: root.addChildren([index, detail]),
      history: createMemoryHistory({ initialEntries: [`/conspectus/${UUID}`] }),
    });
  }, []);

  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Screens/ConspectusDetail',
  component: DetailHost,
  parameters: {
    layout: 'fullscreen',
    router: false,
    docs: {
      description: {
        component:
          'Read-only view of one ETR note: back-link header, title with slot chip, ' +
          'dense paragraph, numbered bullet cells, and the primary review action. ' +
          'Documentation: reference/screens/conspectus-detail.html · design decision: ADR 0038.',
      },
    },
  },
} satisfies Meta<typeof DetailHost>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Populated note — title, slot B chip, dense paragraph, four bullets. */
export const Default: Story = {};
