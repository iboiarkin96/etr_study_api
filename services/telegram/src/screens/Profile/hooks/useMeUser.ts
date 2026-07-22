/**
 * Own user row for the Profile screen — wraps
 * `GET /api/v1/user/{system_uuid}/{system_user_id}`.
 *
 * The reminder preference (`reminder_enabled` / `reminder_at`) lives here;
 * `useUpdateReminder` PATCHes the same resource and keeps this cache slot
 * optimistically in sync.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../app/use-auth';
import { telegramOwnerParams } from '../../../shared/auth/identity';
import type { components } from '../../../shared/api/schema';

export type MeUser = components['schemas']['UserCreateResponse'];

export function useMeUser() {
  const auth = useAuth();

  return useQuery({
    enabled: auth.status === 'authenticated' && !!auth.user,
    queryKey: ['me.user', auth.user?.client_uuid],
    queryFn: async (): Promise<MeUser> => {
      const owner = telegramOwnerParams(auth.user!.telegram_user_id);
      const { data, error } = await auth.api.GET(
        '/api/v1/user/{system_uuid}/{system_user_id}',
        {
          params: {
            path: {
              system_uuid: owner.system_uuid,
              system_user_id: owner.system_user_id,
            },
          },
        },
      );
      if (error) throw new Error(`user/get failed: ${JSON.stringify(error)}`);
      if (!data) throw new Error('user/get returned no body');
      return data;
    },
  });
}
