/**
 * TanStack Router root.
 *
 * Routes:
 *   * `/` — Today (T-11 → T-15d)
 *   * `/conspectus/$conspectus_uuid` — Conspectus detail (T-17)
 *
 * Additional routes (Focus, Conspectus list, Schedule, Errors, Search,
 * Profile, Onboarding) land in T-16 / T-18 / T-19 / T-20 / T-22 / T-23
 * / T-24 per the epic's design contract.
 */

import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';

import { ConspectusDetail } from '../screens/ConspectusDetail';
import { Today } from '../screens/Today';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Today,
});

const conspectusDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/conspectus/$conspectus_uuid',
  component: ConspectusDetail,
});

const routeTree = rootRoute.addChildren([indexRoute, conspectusDetailRoute]);

const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function Router() {
  return <RouterProvider router={router} />;
}
