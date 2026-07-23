/**
 * List hook for `GET /api/v1/errors`.
 *
 * Returns the learner's own error rows, newest first. Server caps the
 * list at 100 (no pagination on the client for W3). Query key mirrors
 * the other Today hooks — includes `client_uuid` so a second Telegram
 * account signing in on the same device gets a separate cache slot.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../app/use-auth';
import { telegramOwnerParams } from '../../../shared/auth/identity';
import type { components } from '../../../shared/api/schema';

export type LearningError = components['schemas']['ErrorLogResponse'];

export function useErrors() {
  const auth = useAuth();

  return useQuery({
    enabled: auth.status === 'authenticated' && !!auth.user,
    queryKey: ['errors.list', auth.user?.client_uuid],
    queryFn: async (): Promise<LearningError[]> => {
      const { data, error } = await auth.api.GET('/api/v1/errors', {
        params: { query: telegramOwnerParams(auth.user!.telegram_user_id) },
      });
      if (error) {
        throw new Error(`errors/list failed: ${JSON.stringify(error)}`);
      }
      return data ?? [];
    },
  });
}
