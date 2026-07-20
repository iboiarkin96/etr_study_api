/**
 * Mutation hook for `POST /api/v1/errors`.
 *
 * Optimistic-append: the new row is inserted at the top of the cached
 * list with a temporary `error_uuid` while the mutation is in-flight;
 * on success it's replaced with the server row. On error the temporary
 * row is rolled back and the caller renders an inline banner.
 *
 * The `Idempotency-Key` header is auto-injected by the client middleware
 * (T-12), so a lost 4G reply on retry never doubles the miss (ADR 0006).
 * Double-submit with the same key returns the same row (server replay).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../../../app/use-auth';
import { telegramOwnerParams } from '../../../shared/auth/identity';
import type { LearningError } from './useErrors';

export type CreateErrorVariables = {
  message: string;
  conspectus_uuid?: string | null;
};

type Context = { previous: LearningError[] | undefined; tempId: string };

export function useCreateError() {
  const auth = useAuth();
  const qc = useQueryClient();
  const clientUuid = auth.user?.client_uuid;
  const telegramUserId = auth.user?.telegram_user_id;

  return useMutation<LearningError, Error, CreateErrorVariables, Context>({
    mutationFn: async ({ message, conspectus_uuid }) => {
      if (telegramUserId == null) {
        throw new Error('createError called before auth resolved');
      }
      const owner = telegramOwnerParams(telegramUserId);
      const { data, error } = await auth.api.POST('/api/v1/errors', {
        // Idempotency-Key is auto-injected by the client middleware. The
        // narrow cast keeps type-checking on `body` — only the required-
        // header field is silenced.
        params: {} as { header: { 'Idempotency-Key': string } },
        body: {
          system_user_id: owner.system_user_id,
          system_uuid: owner.system_uuid,
          message,
          ...(conspectus_uuid ? { conspectus_uuid } : {}),
        },
      });
      if (error) {
        throw new Error(`errors/create failed: ${JSON.stringify(error)}`);
      }
      if (!data) throw new Error('errors/create returned no body');
      return data;
    },

    onMutate: async ({ message, conspectus_uuid }) => {
      const key = ['errors.list', clientUuid] as const;
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<LearningError[]>(key);
      const tempId = `tmp-${Math.random().toString(36).slice(2, 10)}`;
      const optimistic: LearningError = {
        error_uuid: tempId,
        message,
        conspectus_uuid: conspectus_uuid ?? null,
        review_log_id: null,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<LearningError[]>(key, (prev) =>
        prev ? [optimistic, ...prev] : [optimistic],
      );
      return { previous, tempId };
    },

    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      const key = ['errors.list', clientUuid] as const;
      qc.setQueryData<LearningError[]>(key, ctx.previous);
    },

    onSuccess: (row, _vars, ctx) => {
      if (!ctx) return;
      const key = ['errors.list', clientUuid] as const;
      qc.setQueryData<LearningError[]>(key, (prev) =>
        prev ? prev.map((r) => (r.error_uuid === ctx.tempId ? row : r)) : [row],
      );
    },
  });
}
