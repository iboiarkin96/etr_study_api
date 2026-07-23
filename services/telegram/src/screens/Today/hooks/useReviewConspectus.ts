/**
 * Mutation hook for `POST /api/v1/conspectuses/{uuid}/actions/review`.
 *
 * Pessimistic: the row stays in the due-list cache while the mutation is
 * in-flight, and is removed from the cache only on server-side success. The
 * parent (Today) drives the row's `data-committing` state independently via
 * a Map<uuid, direction> so the visual «row slides off» plays for the whole
 * request lifetime and never desyncs from server truth. On error the row is
 * left in the list, the parent adds the uuid to `failedUuids`, and shows an
 * inline banner naming the failure.
 *
 * The `Idempotency-Key` header is auto-injected by the client middleware
 * (T-12), so a lost 4G reply on retry never doubles the review (ADR 0006).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../../../app/use-auth';
import { telegramOwnerParams } from '../../../shared/auth/identity';
import type { DueConspectus } from './useConspectusesDue';
import { HISTORY_DAYS } from './useScheduleHistory';

export type ReviewTag = 'easy' | 'hard' | 'forgot';

export type ReviewVariables = {
  conspectus_uuid: string;
  tag: ReviewTag;
  /** Optional CC guard for stale rows — sent when we have it. */
  expected_schedule_revision?: number | null;
};

export function useReviewConspectus() {
  const auth = useAuth();
  const qc = useQueryClient();
  const clientUuid = auth.user?.client_uuid;
  const telegramUserId = auth.user?.telegram_user_id;

  return useMutation<DueConspectus, Error, ReviewVariables>({
    mutationFn: async ({ conspectus_uuid, tag, expected_schedule_revision }) => {
      if (telegramUserId == null) {
        throw new Error('reviewConspectus called before auth resolved');
      }
      const owner = telegramOwnerParams(telegramUserId);
      const { data, error } = await auth.api.POST(
        '/api/v1/conspectuses/{conspectus_uuid}/actions/review',
        {
          // Idempotency-Key is auto-injected by the client middleware. The
          // narrow cast keeps type-checking on `path` and `body` — only the
          // required-header field is silenced.
          params: { path: { conspectus_uuid } } as {
            path: { conspectus_uuid: string };
            header: { 'Idempotency-Key': string };
          },
          body: {
            system_user_id: owner.system_user_id,
            system_uuid: owner.system_uuid,
            tag,
            ...(expected_schedule_revision != null && { expected_schedule_revision }),
          },
        },
      );
      if (error) {
        throw new Error(`conspectuses/review failed: ${JSON.stringify(error)}`);
      }
      if (!data) throw new Error('conspectuses/review returned no body');
      return data;
    },

    onSuccess: (_data, { conspectus_uuid }) => {
      // Remove the reviewed row from the due-list cache — server has accepted.
      const dueKey = ['today.conspectuses.due', clientUuid] as const;
      qc.setQueryData<DueConspectus[]>(dueKey, (prev) =>
        prev ? prev.filter((c) => c.conspectus_uuid !== conspectus_uuid) : prev,
      );
      // Refresh dependent surfaces (streak orb + summary strip + heat-map).
      qc.invalidateQueries({ queryKey: ['today.schedule.summary', clientUuid] });
      qc.invalidateQueries({ queryKey: ['me.stats', clientUuid] });
      qc.invalidateQueries({
        queryKey: ['schedule.history', clientUuid, HISTORY_DAYS],
      });
    },
  });
}
