"""Constants for the built-in Telegram identity provider.

The ``systems`` table describes external identity providers; ``telegram`` is one
of them. Rows in ``users`` for people who logged in via a Telegram Mini App
carry ``(system_uuid=TELEGRAM_SYSTEM_UUID, system_user_id=str(telegram_user_id))``
so the composite-key uniqueness contract on ``users`` stays intact.
"""

from __future__ import annotations

TELEGRAM_SYSTEM_UUID = "00000000-0000-4000-8000-000000000001"
TELEGRAM_SYSTEM_CODE = "telegram"
TELEGRAM_SYSTEM_NAME = "Telegram Mini App"
