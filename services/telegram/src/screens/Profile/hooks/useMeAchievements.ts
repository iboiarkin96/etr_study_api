/**
 * Achievement set for the Profile screen — wraps `GET /api/v1/me/achievements`.
 *
 * Everything is computed server-side on read (no persisted unlock rows), so
 * the chips can never disagree with the data behind them. Keys are a closed
 * set the client maps to icon + label; see AchievementChips.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../../app/use-auth';
import { telegramOwnerParams } from '../../../shared/auth/identity';
import type { components } from '../../../shared/api/schema';

export type Achievement = components['schemas']['Achievement'];
export type MeAchievements = components['schemas']['MeAchievementsResponse'];

export function useMeAchievements() {
  const auth = useAuth();

  return useQuery({
    enabled: auth.status === 'authenticated' && !!auth.user,
    queryKey: ['me.achievements', auth.user?.client_uuid],
    queryFn: async (): Promise<MeAchievements> => {
      const { data, error } = await auth.api.GET('/api/v1/me/achievements', {
        params: { query: telegramOwnerParams(auth.user!.telegram_user_id) },
      });
      if (error) throw new Error(`me/achievements failed: ${JSON.stringify(error)}`);
      if (!data) throw new Error('me/achievements returned no body');
      return data;
    },
  });
}
