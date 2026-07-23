"""Telegram Mini App ``initData`` HMAC verifier.

Follows `Telegram's spec <https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app>`_:

  1. ``secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)``
  2. Build ``data_check_string`` — all fields except ``hash``, sorted by key,
     joined with ``\\n`` as ``key=value``.
  3. Compare ``HMAC_SHA256(key=secret_key, msg=data_check_string)`` against the
     ``hash`` field from the payload.
  4. Reject if ``auth_date`` is older than ``max_age_seconds``.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qsl


class InvalidInitData(ValueError):
    """Raised when Telegram ``initData`` fails HMAC verification or freshness checks."""


@dataclass(frozen=True)
class TelegramInitDataUser:
    """Trusted subset of Telegram's ``initData.user`` payload.

    Attributes:
        id: Numeric Telegram user id (int64).
        first_name: Given name; always present per Telegram spec.
        last_name: Family name; optional.
        username: Public ``@handle``; optional.
        photo_url: Avatar URL; optional.
        language_code: BCP-47 language code (e.g. ``en``, ``ru``); optional.
    """

    id: int
    first_name: str
    last_name: str | None
    username: str | None
    photo_url: str | None
    language_code: str | None


@dataclass(frozen=True)
class TelegramInitData:
    """Verified ``initData`` payload with the user block extracted.

    Attributes:
        user: Structured user block from ``initData.user``.
        auth_date: Unix seconds when Telegram signed the payload.
        raw_fields: All parsed key-value pairs from the query string, for logging.
    """

    user: TelegramInitDataUser
    auth_date: int
    raw_fields: dict[str, str]


def verify_init_data(
    raw_init_data: str,
    bot_token: str,
    *,
    max_age_seconds: int,
    now_epoch_seconds: int | None = None,
) -> TelegramInitData:
    """Verify a raw ``initData`` query string and return the parsed payload.

    Args:
        raw_init_data: The exact string returned by ``window.Telegram.WebApp.initData``.
        bot_token: BotFather token; used as the HMAC-key ingredient.
        max_age_seconds: Reject payloads whose ``auth_date`` is older than this
            (replay protection).
        now_epoch_seconds: Injected clock for tests; defaults to ``time.time()``.

    Returns:
        Parsed :class:`TelegramInitData` on success.

    Raises:
        InvalidInitData: On any of these failures — empty input, no bot token,
            missing/malformed ``hash`` or ``auth_date``, tampered signature,
            stale ``auth_date``, or invalid ``user`` JSON.
    """
    if not raw_init_data:
        raise InvalidInitData("initData is empty")
    if not bot_token:
        raise InvalidInitData("bot token is not configured")

    # keep_blank_values so a field like `hash=` still parses (and fails signature).
    fields = dict(parse_qsl(raw_init_data, keep_blank_values=True, strict_parsing=False))
    provided_hash = fields.pop("hash", None)
    if not provided_hash:
        raise InvalidInitData("initData is missing `hash` field")
    # NOTE on `signature` (Bot API 7.2+): the field IS part of the HMAC
    # data-check-string on iOS Telegram 9.6+, verified live against a real
    # Menu-Button launch. We initially assumed it should be stripped (some
    # third-party libraries do); that broke on-device handshakes with
    # «signature does not match» while our own dev signer round-tripped
    # green because it never emits `signature`. Keep it in the string.

    data_check_string = "\n".join(f"{k}={fields[k]}" for k in sorted(fields))
    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    expected_hash = hmac.new(
        secret_key, data_check_string.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected_hash, provided_hash):
        raise InvalidInitData("initData signature does not match")

    raw_auth_date = fields.get("auth_date")
    if not raw_auth_date:
        raise InvalidInitData("initData is missing `auth_date` field")
    try:
        auth_date = int(raw_auth_date)
    except ValueError as exc:
        raise InvalidInitData(f"auth_date is not an integer: {raw_auth_date!r}") from exc

    now = int(now_epoch_seconds if now_epoch_seconds is not None else time.time())
    if auth_date > now + 60:
        raise InvalidInitData("auth_date is in the future")
    if now - auth_date > max_age_seconds:
        raise InvalidInitData(f"auth_date is stale by {now - auth_date}s (max {max_age_seconds}s)")

    raw_user = fields.get("user")
    if not raw_user:
        raise InvalidInitData("initData is missing `user` field")
    try:
        user_dict: dict[str, Any] = json.loads(raw_user)
    except json.JSONDecodeError as exc:
        raise InvalidInitData(f"user field is not valid JSON: {exc}") from exc
    if not isinstance(user_dict, dict) or "id" not in user_dict:
        raise InvalidInitData("user field is missing `id`")
    try:
        user = TelegramInitDataUser(
            id=int(user_dict["id"]),
            first_name=str(user_dict.get("first_name", "") or ""),
            last_name=_optional_str(user_dict.get("last_name")),
            username=_optional_str(user_dict.get("username")),
            photo_url=_optional_str(user_dict.get("photo_url")),
            language_code=_optional_str(user_dict.get("language_code")),
        )
    except (TypeError, ValueError) as exc:
        raise InvalidInitData(f"user block is malformed: {exc}") from exc

    return TelegramInitData(user=user, auth_date=auth_date, raw_fields=fields)


def _optional_str(value: Any) -> str | None:
    """Return trimmed string or ``None`` if the source is missing / empty."""
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def build_init_data_for_tests(
    *,
    bot_token: str,
    user: dict[str, Any],
    auth_date: int,
    extra_fields: dict[str, str] | None = None,
) -> str:
    """Mint a signed ``initData`` string for tests / dev signing helper.

    Not exposed from any HTTP route — this is a build-time convenience that
    reproduces exactly the same HMAC steps Telegram uses so ``verify_init_data``
    round-trips against real payloads and synthetic ones.

    Args:
        bot_token: Same token the verifier expects. Real Telegram uses the bot's
            token; tests / the dev signer use the local ``TELEGRAM_BOT_TOKEN``.
        user: Dict shaped like Telegram's ``initData.user`` (must contain ``id``).
        auth_date: Unix seconds; pin during tests or set to ``int(time.time())``.
        extra_fields: Additional top-level ``initData`` fields (e.g. ``query_id``,
            ``start_param``); optional.

    Returns:
        URL-encoded ``initData`` string with a valid ``hash`` field appended.
    """
    from urllib.parse import urlencode

    fields: dict[str, str] = dict(extra_fields or {})
    fields["auth_date"] = str(auth_date)
    fields["user"] = json.dumps(user, separators=(",", ":"), ensure_ascii=False)
    data_check_string = "\n".join(f"{k}={fields[k]}" for k in sorted(fields))
    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    computed = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()
    fields["hash"] = computed
    return urlencode(fields)
