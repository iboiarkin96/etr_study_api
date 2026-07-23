/**
 * Data hook for the Today streak orb — wraps `GET /api/v1/me/stats`.
 *
 * Server computes the current + longest streak from `conspectus_review_logs`
 * (24-hour grace so yesterday still counts as «alive»). See
 * `services/api/app/services/me_service.py::stats`.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../app/use-auth';
import { telegramOwnerParams } from '../../../shared/auth/identity';
import type { components } from '../../../shared/api/schema';

export type MeStats = components['schemas']['MeStatsResponse'];

export function useMeStats() {
  const auth = useAuth();

  return useQuery({
    enabled: auth.status === 'authenticated' && !!auth.user,
    queryKey: ['me.stats', auth.user?.client_uuid],
    queryFn: async (): Promise<MeStats> => {
      const { data, error } = await auth.api.GET('/api/v1/me/stats', {
        params: { query: telegramOwnerParams(auth.user!.telegram_user_id) },
      });
      if (error) throw new Error(`me/stats failed: ${JSON.stringify(error)}`);
      if (!data) throw new Error('me/stats returned no body');
      return data;
    },
  });
}
