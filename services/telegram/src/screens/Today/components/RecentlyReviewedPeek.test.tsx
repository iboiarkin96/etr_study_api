/**
 * Rendering test for `RecentlyReviewedPeek`.
 *
 * The block is opt-out — an empty list returns `null` so no dangling
 * section label appears. Populated: every item's title lands on screen
 * and the row structure hits `.tma-peek__row` for the kit's styling.
 *
 * Router context: `<Link>` needs a mounted `RouterProvider`. We build a
 * tiny in-memory router with a single index route so the peek's
 * navigation targets resolve without loading the real app tree.
 */

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { initI18n } from '../../../shared/i18n';
import { RecentlyReviewedPeek } from './RecentlyReviewedPeek';
import type { DueConspectus } from '../hooks/useConspectusesDue';

initI18n();

function stub(uuid: string, title: string, slot: DueConspectus['slot']): DueConspectus {
  return {
    conspectus_uuid: uuid,
    title,
    slot,
    next_review_at: null,
  } as DueConspectus;
}

function renderWithRouter(node: React.ReactElement) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => node,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/conspectus/$conspectus_uuid',
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  return render(<RouterProvider router={router} />);
}

describe('<RecentlyReviewedPeek>', () => {
  test('returns null when the list is empty', () => {
    const { container } = renderWithRouter(<RecentlyReviewedPeek items={[]} />);
    expect(container.querySelector('.tma-peek')).toBeNull();
  });

  test('renders every provided item title inside a peek row', async () => {
    const items = [
      stub('u-a', 'First title', 'A'),
      stub('u-b', 'Second title', 'B'),
      stub('u-c', 'Third title', 'C'),
    ];
    const { container } = renderWithRouter(<RecentlyReviewedPeek items={items} />);
    await screen.findByText('First title');
    expect(screen.getByText('Second title')).toBeTruthy();
    expect(screen.getByText('Third title')).toBeTruthy();
    expect(container.querySelectorAll('.tma-peek__row').length).toBe(3);
    expect(container.querySelector('.tma-peek')).toBeTruthy();
  });
});
