import type { Meta, StoryObj } from '@storybook/react-vite';

import type { DueConspectus } from '../hooks/useConspectusesDue';

import { DueCardsList } from './DueCardsList';

/**
 * Compact factory — the type is heavy (16+ fields), but the Cell only
 * consumes a handful. Casting keeps stories readable without turning
 * every fixture into a wall of nulls.
 */
function due(over: Partial<DueConspectus>): DueConspectus {
  return {
    conspectus_uuid: 'stub',
    title: 'Untitled',
    slot: 'A',
    next_review_at: '2026-07-19T09:00:00Z',
    schedule_revision: 1,
    ...over,
  } as DueConspectus;
}

const meta = {
  title: 'Today/DueCardsList',
  component: DueCardsList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Due cards — slot-tinted rows routing to the conspectus detail. Swipe right → easy, swipe left → hard, swipe left further → forgot (fires `onReview`). Docs: reference/screens/today.html (pin 6) · reference/components/due-cards-list.html.',
      },
    },
  },
  args: {
    onReview: (uuid, tag) => {
      console.info('[DueCardsList] onReview', { uuid, tag });
    },
  },
} satisfies Meta<typeof DueCardsList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Six due cards — one of each slot with a couple of extras. */
export const Populated: Story = {
  args: {
    items: [
      due({ conspectus_uuid: '00000000-0000-4000-8000-000000000001', title: 'CAP theorem — trade-offs', slot: 'A', next_review_at: new Date(Date.now() - 5 * 60_000).toISOString() }),
      due({ conspectus_uuid: '00000000-0000-4000-8000-000000000002', title: 'Kafka partition rebalancing', slot: 'B', next_review_at: new Date(Date.now() + 25 * 60_000).toISOString() }),
      due({ conspectus_uuid: '00000000-0000-4000-8000-000000000003', title: 'Redis Streams vs Pub/Sub', slot: 'C', next_review_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString() }),
      due({ conspectus_uuid: '00000000-0000-4000-8000-000000000004', title: 'Circuit breaker patterns', slot: 'D', next_review_at: new Date(Date.now() + 6 * 3600 * 1000).toISOString() }),
      due({ conspectus_uuid: '00000000-0000-4000-8000-000000000005', title: 'BGP route reflectors', slot: 'A', next_review_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString() }),
      due({ conspectus_uuid: '00000000-0000-4000-8000-000000000006', title: 'gRPC deadlines & cancellation', slot: 'B', next_review_at: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString() }),
    ],
  },
};

/** Single due card — the «last one for today» state. */
export const SingleItem: Story = {
  args: {
    items: [
      due({ conspectus_uuid: '00000000-0000-4000-8000-000000000010', title: 'Consistent-hashing rings', slot: 'A' }),
    ],
  },
};
