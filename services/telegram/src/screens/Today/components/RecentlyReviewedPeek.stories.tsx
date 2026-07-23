import type { Meta, StoryObj } from '@storybook/react-vite';

import type { DueConspectus } from '../hooks/useConspectusesDue';

import { RecentlyReviewedPeek } from './RecentlyReviewedPeek';

function item(over: Partial<DueConspectus>): DueConspectus {
  return {
    conspectus_uuid: 'stub',
    title: 'Untitled',
    slot: 'A',
    next_review_at: '2026-07-19T09:00:00Z',
    ...over,
  } as DueConspectus;
}

const meta = {
  title: 'Today/RecentlyReviewedPeek',
  component: RecentlyReviewedPeek,
  parameters: {
    layout: 'padded',
    docs: { description: { component: "Quiet lined peek of recently-reviewed notes. Docs: reference/screens/today.html (pin 7)." } },
  },
} satisfies Meta<typeof RecentlyReviewedPeek>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Five recently-reviewed rows across all four slots. */
export const Populated: Story = {
  args: {
    items: [
      item({ conspectus_uuid: '00000000-0000-4000-8000-000000000101', title: 'Cache invalidation strategies', slot: 'A' }),
      item({ conspectus_uuid: '00000000-0000-4000-8000-000000000102', title: 'B-tree vs LSM indexing', slot: 'B' }),
      item({ conspectus_uuid: '00000000-0000-4000-8000-000000000103', title: 'Actor model vs CSP', slot: 'C' }),
      item({ conspectus_uuid: '00000000-0000-4000-8000-000000000104', title: 'Idempotency keys for POST', slot: 'D' }),
      item({ conspectus_uuid: '00000000-0000-4000-8000-000000000105', title: 'JWT vs opaque session tokens', slot: 'A' }),
    ],
  },
};

/** Empty — the component renders nothing (self-hides). */
export const Empty: Story = {
  args: { items: [] },
};
