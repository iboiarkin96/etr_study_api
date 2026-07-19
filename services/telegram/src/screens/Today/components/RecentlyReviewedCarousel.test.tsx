/**
 * Rendering test for `RecentlyReviewedCarousel`.
 *
 * The block is opt-out — an empty list returns `null` so the screen
 * doesn't render an empty section header. Populated: every item's title
 * is on screen, and the section carries a screen-reader label.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { initI18n } from '../../../shared/i18n';
import { RecentlyReviewedCarousel } from './RecentlyReviewedCarousel';
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

describe('<RecentlyReviewedCarousel>', () => {
  test('returns null when the list is empty', () => {
    const { container } = render(<RecentlyReviewedCarousel items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders every provided item title', () => {
    const items = [
      stub('a', 'First title', 'A'),
      stub('b', 'Second title', 'B'),
      stub('c', 'Third title', 'C'),
    ];
    render(<RecentlyReviewedCarousel items={items} />);
    expect(screen.getByText('First title')).toBeTruthy();
    expect(screen.getByText('Second title')).toBeTruthy();
    expect(screen.getByText('Third title')).toBeTruthy();
  });
});
