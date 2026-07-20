/**
 * Full-library conspectus index for the Search overlay.
 *
 * Fetches `GET /api/v1/conspectuses` once and caches indefinitely — the
 * server has no `q=` param, so search is a client-side substring filter
 * over this array. `staleTime: Infinity` on the query so background
 * refetches don't re-request the full list on every overlay open; the
 * cache invalidates only when a mutation touches a conspectus (see
 * `useReviewConspectus.onSuccess` — TODO: also invalidate this key when
 * conspectus create/patch/delete lands, currently harmless because no
 * writer surface exists yet in the MVP).
 *
 * Big-list guard: server caps `limit` at 100 (see api/v1/conspectus.py —
 * `Query(ge=1, le=100)`); passing anything above trips a 422. When the
 * library grows past `PAGE_LIMIT`, `hasMore` returns true and the overlay
 * surfaces a «showing first N» hint so titles beyond the cap aren't
 * silently unsearchable. A follow-up task can paginate over `next_cursor`
 * with useInfiniteQuery.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../app/use-auth';
import { telegramOwnerParams } from '../../../shared/auth/identity';
import type { components } from '../../../shared/api/schema';

export type ConspectusRow = components['schemas']['ConspectusResponse'];

export type ConspectusListPage = {
  items: ConspectusRow[];
  /** Server flag — true when there are more titles beyond `items.length`.
   * Surface it in the overlay so users know their search doesn't cover
   * the whole library. */
  hasMore: boolean;
};

export const PAGE_LIMIT = 100;

export function useConspectusesList() {
  const auth = useAuth();

  return useQuery({
    enabled: auth.status === 'authenticated' && !!auth.user,
    queryKey: ['conspectuses.list', auth.user?.client_uuid],
    staleTime: Infinity,
    queryFn: async (): Promise<ConspectusListPage> => {
      const { data, error } = await auth.api.GET('/api/v1/conspectuses', {
        params: {
          query: {
            ...telegramOwnerParams(auth.user!.telegram_user_id),
            limit: PAGE_LIMIT,
          },
        },
      });
      if (error) throw new Error(`conspectuses/list failed: ${JSON.stringify(error)}`);
      if (!data) throw new Error('conspectuses/list returned no body');
      return { items: data.items ?? [], hasMore: data.has_more ?? false };
    },
  });
}
