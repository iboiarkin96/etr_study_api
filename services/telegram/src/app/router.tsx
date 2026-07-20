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
import { SearchProvider } from '../screens/Search/SearchProvider';
import { Today } from '../screens/Today';

// SearchProvider lives INSIDE RouterProvider (via the root route's component)
// because SearchOverlay's Enter handler calls `useNavigate()` — that hook
// requires RouterProvider context. Wrapping providers.tsx one level up would
// crash at first Enter. Overlay also needs to render across every route,
// hence the layout-route pattern.
const rootRoute = createRootRoute({
  component: () => (
    <SearchProvider>
      <Outlet />
    </SearchProvider>
  ),
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

/** Query params for /errors. When Focus completes a session with at least one
 * Again/Hard grade, the completion screen navigates here with
 * `?prefill_from=session&conspectus_uuid=<uuid>[&conspectus_title=<title>]`
 * so the Errors screen can auto-open the MissSheet with the conspectus link
 * already attached. Deep-linking from bookmarks lands on `/errors` with no
 * params — screen just renders the list. */
export type ErrorsSearch = {
  prefill_from?: 'session';
  conspectus_uuid?: string;
  conspectus_title?: string;
};

const errorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/errors',
  component: Errors,
  validateSearch: (raw: Record<string, unknown>): ErrorsSearch => {
    const out: ErrorsSearch = {};
    if (raw.prefill_from === 'session') out.prefill_from = 'session';
    if (typeof raw.conspectus_uuid === 'string' && raw.conspectus_uuid.length > 0) {
      out.conspectus_uuid = raw.conspectus_uuid;
    }
    if (typeof raw.conspectus_title === 'string' && raw.conspectus_title.length > 0) {
      out.conspectus_title = raw.conspectus_title.slice(0, 200);
    }
    return out;
  },
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
