/**
 * TanStack Router root.
 *
 * Routes:
 *   * `/` — Today (T-11 → T-15d)
 *   * `/conspectus/$conspectus_uuid` — Conspectus detail (T-17)
 *   * `/focus` — Focus (T-18)
 *   * `/schedule` — Schedule (T-19)
 *   * `/errors` — Errors miss log (T-20)
 *
 * Additional routes (Conspectus list, Search, Profile, Onboarding) land
 * in T-22 / T-23 / T-24 per the epic's design contract.
 */

import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';

import { ConspectusDetail } from '../screens/ConspectusDetail';
import { Errors } from '../screens/Errors';
import { Focus } from '../screens/Focus';
import { Schedule } from '../screens/Schedule';
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

const focusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/focus',
  component: Focus,
});

const scheduleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/schedule',
  component: Schedule,
});

const errorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/errors',
  component: Errors,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  conspectusDetailRoute,
  focusRoute,
  scheduleRoute,
  errorsRoute,
]);

const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function Router() {
  return <RouterProvider router={router} />;
}
