/**
 * Mutation hook for the daily-nudge preference — PATCHes
 * `/api/v1/user/{system_uuid}/{system_user_id}` with
 * `{reminder_enabled, reminder_at}`.
 *
 * Optimistic: the `['me.user', client_uuid]` cache slot flips immediately so
 * the sheet's badge reads the new state without a round-trip; rolled back on
 * error (parent keeps the sheet open with an inline message). On success the
 * server row replaces the optimistic guess wholesale.
 *
 * `Idempotency-Key` is auto-injected by the client middleware (T-12) — a
 * retried PATCH after a lost reply never double-applies (ADR 0006).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../../../app/use-auth';
import { telegramOwnerParams } from '../../../shared/auth/identity';
import type { MeUser } from './useMeUser';

export type UpdateReminderVariables = {
  reminder_enabled: 0 | 1;
  reminder_at: string;
};

type Context = { previous: MeUser | undefined };

export function useUpdateReminder() {
  const auth = useAuth();
  const qc = useQueryClient();
  const clientUuid = auth.user?.client_uuid;

  return useMutation<MeUser, Error, UpdateReminderVariables, Context>({
    mutationFn: async ({ reminder_enabled, reminder_at }) => {
      if (auth.user == null) {
        throw new Error('updateReminder called before auth resolved');
      }
      const owner = telegramOwnerParams(auth.user.telegram_user_id);
      const { data, error } = await auth.api.PATCH(
        '/api/v1/user/{system_uuid}/{system_user_id}',
        {
          // Idempotency-Key is auto-injected by the client middleware; the
          // narrow cast silences only the required-header field.
          params: {
            path: {
              system_uuid: owner.system_uuid,
              system_user_id: owner.system_user_id,
            },
          } as {
            path: { system_uuid: string; system_user_id: string };
            header: { 'Idempotency-Key': string };
          },
          body: { reminder_enabled, reminder_at },
        },
      );
      if (error) throw new Error(`user/patch failed: ${JSON.stringify(error)}`);
      if (!data) throw new Error('user/patch returned no body');
      return data;
    },

    onMutate: async ({ reminder_enabled, reminder_at }) => {
      const key = ['me.user', clientUuid] as const;
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<MeUser>(key);
      if (previous) {
        qc.setQueryData<MeUser>(key, { ...previous, reminder_enabled, reminder_at });
      }
      return { previous };
    },

    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      qc.setQueryData<MeUser>(['me.user', clientUuid], ctx.previous);
    },

    onSuccess: (row) => {
      qc.setQueryData<MeUser>(['me.user', clientUuid], row);
    },
  });
}
