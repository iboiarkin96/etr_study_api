/**
 * Data hook for the Today heat-map — wraps `GET /api/v1/schedule/history`.
 *
 * Server materialises per-day review counts (with zero-fills) for the
 * previous `days` days and buckets each into an intensity 0..4.
 * See `services/api/app/services/me_service.py::history`.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../app/use-auth';
import { telegramOwnerParams } from '../../../shared/auth/identity';
import type { components } from '../../../shared/api/schema';

export type ScheduleHistory = components['schemas']['ScheduleHistoryResponse'];

export function useScheduleHistory(days = 90) {
  const auth = useAuth();

  return useQuery({
    enabled: auth.status === 'authenticated' && !!auth.user,
    queryKey: ['schedule.history', auth.user?.client_uuid, days],
    queryFn: async (): Promise<ScheduleHistory> => {
      const { data, error } = await auth.api.GET('/api/v1/schedule/history', {
        params: {
          query: { ...telegramOwnerParams(auth.user!.telegram_user_id), days },
        },
      });
      if (error) throw new Error(`schedule/history failed: ${JSON.stringify(error)}`);
      if (!data) throw new Error('schedule/history returned no body');
      return data;
    },
  });
}
