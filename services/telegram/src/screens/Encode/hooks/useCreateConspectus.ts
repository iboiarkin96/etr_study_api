/**
 * Mutation hook for `POST /api/v1/conspectuses`.
 *
 * Server-authoritative (no optimistic update): the ETR conspectus needs a
 * server-assigned `conspectus_uuid` and initial `ConspectusSchedule` row
 * before it's usable anywhere in the app. On success we invalidate both
 * `conspectuses.list` (Search overlay) and `today.conspectuses.due` (Today
 * card list) so the new entry appears without a manual refresh.
 *
 * `Idempotency-Key` is auto-injected by the client middleware (T-12) — a
 * lost reply on retry never creates a duplicate note (ADR 0006).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../../../app/use-auth';
import { telegramOwnerParams } from '../../../shared/auth/identity';
import type { components } from '../../../shared/api/schema';

export type ConspectusRow = components['schemas']['ConspectusResponse'];

export type CreateConspectusVariables = {
  title: string | null;
  dense_paragraph: string;
  bullets: string[];
  cue_sheet: {
    terms?: string[];
    questions?: string[];
  };
};

export function useCreateConspectus() {
  const auth = useAuth();
  const qc = useQueryClient();
  const clientUuid = auth.user?.client_uuid;
  const telegramUserId = auth.user?.telegram_user_id;

  return useMutation<ConspectusRow, Error, CreateConspectusVariables>({
    mutationFn: async ({ title, dense_paragraph, bullets, cue_sheet }) => {
      if (telegramUserId == null) {
        throw new Error('createConspectus called before auth resolved');
      }
      const owner = telegramOwnerParams(telegramUserId);
      const { data, error } = await auth.api.POST('/api/v1/conspectuses', {
        params: {} as { header: { 'Idempotency-Key': string } },
        body: {
          system_user_id: owner.system_user_id,
          system_uuid: owner.system_uuid,
          ...(title && title.trim() ? { title: title.trim() } : {}),
          dense_paragraph,
          bullets,
          cue_sheet: cue_sheet as Record<string, unknown>,
        },
      });
      if (error) {
        throw new Error(`conspectuses/create failed: ${JSON.stringify(error)}`);
      }
      if (!data) throw new Error('conspectuses/create returned no body');
      return data;
    },

    onSuccess: () => {
      // Search index + Today's due list can both surface the new row.
      void qc.invalidateQueries({ queryKey: ['conspectuses.list', clientUuid] });
      void qc.invalidateQueries({ queryKey: ['today.conspectuses.due', clientUuid] });
    },
  });
}
