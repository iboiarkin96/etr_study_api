/**
 * Data hook for the Today screen's schedule-summary widget.
 *
 * Wraps `GET /api/v1/schedule/summary` — server-side pre-aggregated counts,
 * per the design contract «no client-side aggregation».
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../app/use-auth';
import { telegramOwnerParams } from '../../../shared/auth/identity';
import type { components } from '../../../shared/api/schema';

export type ScheduleSummary = components['schemas']['ScheduleSummaryResponse'];

export function useScheduleSummary() {
  const auth = useAuth();

  return useQuery({
    enabled: auth.status === 'authenticated' && !!auth.user,
    queryKey: ['today.schedule.summary', auth.user?.client_uuid],
    queryFn: async (): Promise<ScheduleSummary> => {
      const { data, error } = await auth.api.GET('/api/v1/schedule/summary', {
        params: { query: telegramOwnerParams(auth.user!.telegram_user_id) },
      });
      if (error) {
        throw new Error(`schedule/summary failed: ${JSON.stringify(error)}`);
      }
      if (!data) throw new Error('schedule/summary returned no body');
      return data;
    },
  });
}
