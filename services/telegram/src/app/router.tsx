/**
 * TanStack Router root — one placeholder `/` route for T-11.
 *
 * Additional routes (Focus, Conspectus, Schedule, Errors, Search, Profile,
 * Onboarding) land in T-15 / T-17 / T-19 / T-20 / T-22 / T-23 / T-24 per
 * the epic's design contract (services/portal/internal/services/telegram/
 * design/screens.html + information-architecture.html).
 */

import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';

import { Today } from '../screens/Today';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Today,
});

const routeTree = rootRoute.addChildren([indexRoute]);

const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function Router() {
  return <RouterProvider router={router} />;
}
