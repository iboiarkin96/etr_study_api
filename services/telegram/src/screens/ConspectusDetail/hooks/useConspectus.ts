/**
 * Data hook for the Conspectus detail screen — wraps
 * `GET /api/v1/conspectuses/{conspectus_uuid}`.
 *
 * Server returns the full ETR shape: title + cue_sheet + dense_paragraph
 * + bullets + slot / next-review. Query is gated on auth (same enable
 * rule the other Today hooks use).
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../app/use-auth';
import { telegramOwnerParams } from '../../../shared/auth/identity';
import type { components } from '../../../shared/api/schema';

export type ConspectusDetail = components['schemas']['ConspectusResponse'];

export function useConspectus(conspectusUuid: string) {
  const auth = useAuth();

  return useQuery({
    enabled: auth.status === 'authenticated' && !!auth.user && !!conspectusUuid,
    queryKey: ['conspectus.detail', auth.user?.client_uuid, conspectusUuid],
    queryFn: async (): Promise<ConspectusDetail> => {
      const { data, error } = await auth.api.GET('/api/v1/conspectuses/{conspectus_uuid}', {
        params: {
          path: { conspectus_uuid: conspectusUuid },
          query: telegramOwnerParams(auth.user!.telegram_user_id),
        },
      });
      if (error) throw new Error(`conspectuses/{id} failed: ${JSON.stringify(error)}`);
      if (!data) throw new Error('conspectuses/{id} returned no body');
      return data;
    },
  });
}
