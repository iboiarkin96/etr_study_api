/**
 * Stories cover the four visually-distinct states from the mock: hint
 * (empty query), matches (query typed), no-matches, and loading. Auth +
 * fake list are seeded per-story via the same WithAuth pattern as Focus
 * and Schedule stories.
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
import type { ComponentType, ReactNode } from 'react';
import { useMemo } from 'react';

import { AuthContext, type AuthContextValue } from '../../../app/auth-context';
import type { components } from '../../../shared/api/schema';
import { SearchOverlay } from './SearchOverlay';

type ConspectusResponse = components['schemas']['ConspectusResponse'];

function makeAuth(list: Partial<ConspectusResponse>[]): AuthContextValue {
  return {
    status: 'authenticated',
    jwt: 'stub',
    user: { client_uuid: 'client', telegram_user_id: 42 } as AuthContextValue['user'],
    error: null,
    retry: () => {},
    api: {
      GET: async () => ({
        data: { items: list as ConspectusResponse[], next_cursor: null, count: list.length, has_more: false },
        error: undefined,
      }),
      POST: async () => ({ data: undefined, error: undefined }),
      PUT: async () => ({ data: undefined, error: undefined }),
      PATCH: async () => ({ data: undefined, error: undefined }),
      DELETE: async () => ({ data: undefined, error: undefined }),
    } as unknown as AuthContextValue['api'],
  };
}

function WithAuth({ auth, children }: { auth: AuthContextValue; children: ReactNode }) {
  const qc = useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }), []);
  const router = useMemo(() => {
    const root = createRootRoute({ component: () => <Outlet /> });
    const index = createRoute({ getParentRoute: () => root, path: '/', component: () => <>{children}</> });
    const detail = createRoute({ getParentRoute: () => root, path: '/conspectus/$conspectus_uuid', component: () => null });
    return createRouter({
      routeTree: root.addChildren([index, detail]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });
  }, [children]);
  return (
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

const DEMO_LIBRARY: Partial<ConspectusResponse>[] = [
  { conspectus_uuid: 'a1', title: 'CAP theorem — trade-offs in the wild', slot: 'A', schedule_revision: 1 },
  { conspectus_uuid: 'a2', title: 'Kafka partition rebalancing under load', slot: 'B', schedule_revision: 1 },
  { conspectus_uuid: 'a3', title: 'SRP · one reason to change', slot: 'A', schedule_revision: 1 },
  { conspectus_uuid: 'a4', title: 'Circuit breaker patterns', slot: 'D', schedule_revision: 1 },
  { conspectus_uuid: 'a5', title: 'BGP route reflectors', slot: 'C', schedule_revision: 1 },
  { conspectus_uuid: 'a6', title: 'gRPC deadlines & cancellation', slot: 'B', schedule_revision: 1 },
  { conspectus_uuid: 'a7', title: 'PostgreSQL indexes — B-tree vs BRIN vs GIN', slot: 'A', schedule_revision: 1 },
  { conspectus_uuid: 'a8', title: 'TCP handshake → CLOSE_WAIT', slot: 'A', schedule_revision: 1 },
];

const meta = {
  title: 'Screens/Search/SearchOverlay',
  component: SearchOverlay,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Cmd+K spotlight modal. Client-side substring filter over cached conspectus list. Docs: reference/screens/search.html · reference/components/search-overlay.html.',
      },
    },
  },
} satisfies Meta<typeof SearchOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty query — hint copy visible under the input. */
export const Hint: Story = {
  args: { open: true, onClose: () => {} },
  decorators: [
    (Story: ComponentType) => (
      <WithAuth auth={makeAuth(DEMO_LIBRARY)}>
        <Story />
      </WithAuth>
    ),
  ],
};

/** Populated match — pre-typed query «cap» matches CAP theorem. Note the
 * `<mark>` tag around the matched substring. */
export const Match: Story = {
  args: { open: true, onClose: () => {} },
  decorators: [
    (Story: ComponentType) => (
      <WithAuth auth={makeAuth(DEMO_LIBRARY)}>
        <div>
          <Story />
          <script
            dangerouslySetInnerHTML={{
              __html: `setTimeout(() => { const i = document.querySelector('.tma-cmdk__input'); if (i) { i.value = 'cap'; i.dispatchEvent(new Event('input', { bubbles: true })); } }, 60);`,
            }}
          />
        </div>
      </WithAuth>
    ),
  ],
};

/** No matches — bad query, «no matches for «xyz»» copy. */
export const Empty: Story = {
  args: { open: true, onClose: () => {} },
  decorators: [
    (Story: ComponentType) => (
      <WithAuth auth={makeAuth(DEMO_LIBRARY)}>
        <div>
          <Story />
          <script
            dangerouslySetInnerHTML={{
              __html: `setTimeout(() => { const i = document.querySelector('.tma-cmdk__input'); if (i) { i.value = 'xylophone'; i.dispatchEvent(new Event('input', { bubbles: true })); } }, 60);`,
            }}
          />
        </div>
      </WithAuth>
    ),
  ],
};

/** Loading — the conspectus list fetch is in flight. Skeleton copy. */
export const Loading: Story = {
  args: { open: true, onClose: () => {} },
  decorators: [
    (Story: ComponentType) => {
      const stall: AuthContextValue = {
        ...makeAuth([]),
        api: {
          GET: () => new Promise(() => {}),
          POST: async () => ({ data: undefined, error: undefined }),
          PUT: async () => ({ data: undefined, error: undefined }),
          PATCH: async () => ({ data: undefined, error: undefined }),
          DELETE: async () => ({ data: undefined, error: undefined }),
        } as unknown as AuthContextValue['api'],
      };
      return (
        <WithAuth auth={stall}>
          <Story />
        </WithAuth>
      );
    },
  ],
};
