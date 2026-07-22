/**
 * TanStack Router root.
 *
 * Routes:
 *   * `/` — Today (T-11 → T-15d)
 *   * `/conspectus/$conspectus_uuid` — Conspectus detail (T-17)
 *   * `/focus` — Focus (T-18)
 *   * `/schedule` — Schedule (T-19)
 *   * `/errors` — Errors miss log (T-20)
 *   * `/me` — Profile (T-23)
 *   * `/onboarding` — First-run flow (T-24)
 *
 * The Conspectus list route lands in a later epic slice.
 */

import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';

import { ConspectusDetail } from '../screens/ConspectusDetail';
import { DebugHaptics } from '../screens/DebugHaptics';
import { Errors } from '../screens/Errors';
import { Focus } from '../screens/Focus';
import { Onboarding } from '../screens/Onboarding';
import { OnboardingGate } from '../screens/Onboarding/OnboardingGate';
import { Profile } from '../screens/Profile';
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

// `OnboardingGate` wraps Today: on the first cold open it redirects to
// `/onboarding`; once the flag is set (locally or in CloudStorage) Today
// renders inline. The gate lives on `/` only — `/onboarding` bypasses it
// so a re-entry from the flow itself never bounces the redirect.
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => (
    <OnboardingGate>
      <Today />
    </OnboardingGate>
  ),
});

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  component: Onboarding,
});

const conspectusDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/conspectus/$conspectus_uuid',
  component: ConspectusDetail,
});

/** Query params for /focus. Default (no params) opens the batch flow reading
 * the due list. `?conspectus_uuid=<uuid>` opens the ad-hoc single-card flow
 * from the Conspectus detail «Review now» CTA (T-17c). */
export type FocusSearch = {
  conspectus_uuid?: string;
};

const focusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/focus',
  component: Focus,
  validateSearch: (raw: Record<string, unknown>): FocusSearch => {
    const out: FocusSearch = {};
    if (typeof raw.conspectus_uuid === 'string' && raw.conspectus_uuid.length > 0) {
      out.conspectus_uuid = raw.conspectus_uuid;
    }
    return out;
  },
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

const meRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/me',
  component: Profile,
});

// Hand-testing surface for the haptic vocabulary (T-25c). Not linked from
// the nav; typed into the URL or opened through the CF quick tunnel to feel
// each pattern on a real device.
const debugHapticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/debug/haptics',
  component: DebugHaptics,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  onboardingRoute,
  conspectusDetailRoute,
  focusRoute,
  scheduleRoute,
  errorsRoute,
  meRoute,
  debugHapticsRoute,
]);

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultViewTransition: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function Router() {
  return <RouterProvider router={router} />;
}
