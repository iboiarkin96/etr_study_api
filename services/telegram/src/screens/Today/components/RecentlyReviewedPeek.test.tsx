/**
 * Rendering test for `RecentlyReviewedPeek`.
 *
 * The block is opt-out — an empty list returns `null` so no dangling
 * section label appears. Populated: every item's title lands on screen
 * and the row structure hits `.tma-peek__row` for the kit's styling.
 */

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

describe('<RecentlyReviewedPeek>', () => {
  test('returns null when the list is empty', () => {
    const { container } = render(<RecentlyReviewedPeek items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders every provided item title inside a peek row', () => {
    const items = [
      stub('a', 'First title', 'A'),
      stub('b', 'Second title', 'B'),
      stub('c', 'Third title', 'C'),
    ];
    const { container } = render(<RecentlyReviewedPeek items={items} />);
    expect(screen.getByText('First title')).toBeTruthy();
    expect(screen.getByText('Second title')).toBeTruthy();
    expect(screen.getByText('Third title')).toBeTruthy();
    expect(container.querySelectorAll('.tma-peek__row').length).toBe(3);
    expect(container.querySelector('.tma-peek')).toBeTruthy();
  });
});
