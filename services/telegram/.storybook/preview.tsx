/**
 * Storybook global preview: wraps every story in the same tokens + i18n
 * environment the real app runs under.
 *
 *   1. Pulls in `styles/index.css` so tokens (`--tma-*`) + primitives
 *      (`.tma-orb`, `.tma-heat`, `.tma-cell`, …) resolve identically to
 *      production.
 *   2. Boots i18n once so components calling `useTranslation()` don't blow
 *      up at import time.
 *   3. Wraps each story in `.tma-scope` (Ember dark canvas by default; a
 *      `theme` toolbar switch flips to light on demand).
 *   4. Adds a `router` toolbar switch that either wraps the story in an
 *      in-memory TanStack RouterProvider (needed for anything using
 *      `<Link>`) or leaves it bare.
 */

import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Decorator, Preview } from '@storybook/react-vite';
import { useEffect, useMemo, type ComponentType, type ReactNode } from 'react';

import { initI18n } from '../src/shared/i18n';
import '../src/styles/global.css';
import '../src/styles/index.css';

initI18n();

function RouterHost({ children }: { children: ReactNode }) {
  const router = useMemo(() => {
    const root = createRootRoute({ component: () => <Outlet /> });
    const index = createRoute({
      getParentRoute: () => root,
      path: '/',
      component: () => <>{children}</>,
    });
    const detail = createRoute({
      getParentRoute: () => root,
      path: '/conspectus/$conspectus_uuid',
      component: () => null,
    });
    return createRouter({
      routeTree: root.addChildren([index, detail]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });
  }, [children]);
  return <RouterProvider router={router} />;
}

function QueryHost({ children }: { children: ReactNode }) {
  const client = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    [],
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function ScopeHost({ theme, children }: { theme: 'dark' | 'light'; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return (
    <div
      className="tma-scope"
      data-density="regular"
      style={{
        minHeight: '100vh',
        background: 'var(--tma-surface-canvas)',
        color: 'var(--tma-text-primary)',
        padding: 'var(--tma-sp-6)',
        fontFamily: 'var(--tma-font-sans)',
      }}
    >
      {children}
    </div>
  );
}

const withRouter: Decorator = (Story, ctx) => {
  const wrap = ctx.parameters?.router !== false && ctx.globals.router !== 'off';
  const StoryFn = Story as ComponentType;
  return wrap ? (
    <RouterHost>
      <StoryFn />
    </RouterHost>
  ) : (
    <StoryFn />
  );
};

const withQuery: Decorator = (Story) => {
  const StoryFn = Story as ComponentType;
  return (
    <QueryHost>
      <StoryFn />
    </QueryHost>
  );
};

const withScope: Decorator = (Story, ctx) => {
  const theme = (ctx.globals.theme as 'dark' | 'light' | undefined) ?? 'dark';
  const StoryFn = Story as ComponentType;
  return (
    <ScopeHost theme={theme}>
      <StoryFn />
    </ScopeHost>
  );
};

const preview: Preview = {
  // Autodocs for every story unless a component opts out. Renders a
  // component-level Docs page with description + prop table + all stories.
  tags: ['autodocs'],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: { test: 'todo' },
    layout: 'fullscreen',
    docs: {
      toc: true, // side table of contents on Docs pages
    },
  },
  globalTypes: {
    theme: {
      description: 'Portal theme (dark = production TMA, light = light-theme portal preview)',
      defaultValue: 'dark',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'dark', title: 'Dark' },
          { value: 'light', title: 'Light' },
        ],
        dynamicTitle: true,
      },
    },
    router: {
      description: 'Wrap in an in-memory TanStack RouterProvider (needed for <Link>)',
      defaultValue: 'on',
      toolbar: {
        title: 'Router',
        icon: 'link',
        items: [
          { value: 'on', title: 'On' },
          { value: 'off', title: 'Off' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withQuery, withRouter, withScope],
};

export default preview;
