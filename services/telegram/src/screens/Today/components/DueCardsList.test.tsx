/**
 * Unit tests for `DueCardsList` — split into two shapes:
 *
 *   1. Pure resolvers (`resolveTag`, `resolveTone`) — the numeric contract
 *      the component is built on. Fastest and most reliable.
 *   2. Render smoke — verifies the row markup shape the CSS primitive
 *      selectors depend on (`.tma-swipe`, `.tma-swipe__bg` × 2,
 *      `.tma-swipe__fg`, `.tma-cell`). Full drag simulation is deferred
 *      to Playwright.
 */

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, test } from 'vitest';

import { initI18n } from '../../../shared/i18n';
import type { DueConspectus } from '../hooks/useConspectusesDue';
import { DueCardsList } from './DueCardsList';
import {
  resolveTag,
  resolveTone,
  SWIPE_THRESHOLDS,
} from './swipe-thresholds';

initI18n();

const { ARM, COMMIT, COMMIT_DEEP } = SWIPE_THRESHOLDS;

function due(over: Partial<DueConspectus>): DueConspectus {
  return {
    conspectus_uuid: 'x',
    title: 'X',
    slot: 'A',
    next_review_at: new Date().toISOString(),
    schedule_revision: 1,
    ...over,
  } as DueConspectus;
}

function inRouter(children: ReactNode) {
  const root = createRootRoute({ component: () => createElement(Outlet) });
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => createElement('div', null, children),
  });
  const detail = createRoute({
    getParentRoute: () => root,
    path: '/conspectus/$conspectus_uuid',
    component: () => null,
  });
  const router = createRouter({
    routeTree: root.addChildren([index, detail]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  return createElement(RouterProvider, { router });
}

describe('DueCardsList · resolveTag', () => {
  test('right past +COMMIT → easy', () => {
    expect(resolveTag(COMMIT)).toBe('easy');
    expect(resolveTag(COMMIT + 30)).toBe('easy');
  });
  test('left between -COMMIT and -COMMIT_DEEP → hard', () => {
    expect(resolveTag(-COMMIT)).toBe('hard');
    expect(resolveTag(-COMMIT_DEEP + 1)).toBe('hard');
  });
  test('left past -COMMIT_DEEP → forgot', () => {
    expect(resolveTag(-COMMIT_DEEP)).toBe('forgot');
    expect(resolveTag(-COMMIT_DEEP - 50)).toBe('forgot');
  });
  test('short swipes and taps return null (no commit)', () => {
    expect(resolveTag(0)).toBeNull();
    expect(resolveTag(ARM - 1)).toBeNull();
    expect(resolveTag(-(COMMIT - 1))).toBeNull();
  });
});

describe('DueCardsList · resolveTone', () => {
  test('right = accent', () => expect(resolveTone(20)).toBe('accent'));
  test('shallow left = warn', () => expect(resolveTone(-50)).toBe('warn'));
  test('deep left = danger', () => expect(resolveTone(-COMMIT_DEEP)).toBe('danger'));
});

describe('DueCardsList · render', () => {
  test('every row ships the swipe primitive shape', async () => {
    render(
      inRouter(
        createElement(DueCardsList, {
          items: [
            due({ conspectus_uuid: 'a', title: 'Alpha' }),
            due({ conspectus_uuid: 'b', title: 'Bravo' }),
          ],
        }),
      ),
    );
    // TanStack Router loads the initial route asynchronously.
    await waitFor(() => expect(screen.getAllByRole('listitem').length).toBe(2));

    const rows = screen.getAllByRole('listitem');
    for (const row of rows) {
      expect(row.className).toContain('tma-swipe');
      // two action bars (right = easy, left = hard/forgot) + one draggable fg.
      expect(row.querySelectorAll('.tma-swipe__bg').length).toBe(2);
      expect(row.querySelector('.tma-swipe__fg')).not.toBeNull();
      expect(row.querySelector('a.tma-cell')).not.toBeNull();
    }
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Bravo')).toBeTruthy();
  });
});
