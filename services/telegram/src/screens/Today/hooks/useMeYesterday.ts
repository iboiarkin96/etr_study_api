/**
 * Data hook for the Today YesterdayDigest — wraps `GET /api/v1/me/yesterday`.
 *
 * Server aggregates reviewed / target / accuracy for the previous UTC day.
 * See `services/api/app/services/me_service.py::yesterday`.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../app/use-auth';
import { telegramOwnerParams } from '../../../shared/auth/identity';
import type { components } from '../../../shared/api/schema';

export type MeYesterday = components['schemas']['MeYesterdayResponse'];

export function useMeYesterday() {
  const auth = useAuth();

  return useQuery({
    enabled: auth.status === 'authenticated' && !!auth.user,
    queryKey: ['me.yesterday', auth.user?.client_uuid],
    queryFn: async (): Promise<MeYesterday> => {
      const { data, error } = await auth.api.GET('/api/v1/me/yesterday', {
        params: { query: telegramOwnerParams(auth.user!.telegram_user_id) },
      });
      if (error) throw new Error(`me/yesterday failed: ${JSON.stringify(error)}`);
      if (!data) throw new Error('me/yesterday returned no body');
      return data;
    },
  });
}
