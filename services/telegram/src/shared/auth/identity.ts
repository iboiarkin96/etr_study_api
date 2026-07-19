/**
 * Constants that pair a Telegram-authenticated user with the API's
 * long-standing composite-key wire contract.
 *
 * The API's `/api/v1/*` handlers still accept `(system_user_id, system_uuid)`
 * as query parameters (grandfathered from the pre-Telegram era). Under the
 * shipped W1 auth flow, users authenticated via Telegram carry:
 *
 *   system_user_id = str(telegram_user_id)
 *   system_uuid    = TELEGRAM_SYSTEM_UUID
 *
 * so the composite-key uniqueness stays intact. The migration that seeds
 * this row lives at `services/api/alembic/versions/20260719_0003_add_telegram_users.py`.
 * Keep this constant in sync with `services/api/app/core/telegram_identity.py`.
 */

export const TELEGRAM_SYSTEM_UUID = '00000000-0000-4000-8000-000000000001';

/** Build the composite-key params for a Telegram user's API calls. */
export function telegramOwnerParams(telegramUserId: number): {
  system_user_id: string;
  system_uuid: string;
} {
  return {
    system_user_id: String(telegramUserId),
    system_uuid: TELEGRAM_SYSTEM_UUID,
  };
}
