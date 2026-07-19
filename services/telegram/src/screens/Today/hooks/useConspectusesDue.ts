/**
 * Data hook for the Today screen's due-cards block.
 *
 * Wraps `GET /api/v1/conspectuses/due` in a TanStack Query so screens read
 * one flat `{ data, isPending, isError, refetch }` surface instead of the
 * raw fetch mechanics. Query key includes the caller's `client_uuid` so a
 * second Telegram account signing in on the same device gets a separate
 * cache slot instead of leaking each other's data.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../app/use-auth';
import { telegramOwnerParams } from '../../../shared/auth/identity';
import type { components } from '../../../shared/api/schema';

export type DueConspectus = components['schemas']['ConspectusResponse'];

export function useConspectusesDue() {
  const auth = useAuth();

  return useQuery({
    enabled: auth.status === 'authenticated' && !!auth.user,
    queryKey: ['today.conspectuses.due', auth.user?.client_uuid],
    queryFn: async (): Promise<DueConspectus[]> => {
      const { data, error } = await auth.api.GET('/api/v1/conspectuses/due', {
        params: { query: telegramOwnerParams(auth.user!.telegram_user_id) },
      });
      if (error) {
        throw new Error(`conspectuses/due failed: ${JSON.stringify(error)}`);
      }
      return data ?? [];
    },
  });
}
