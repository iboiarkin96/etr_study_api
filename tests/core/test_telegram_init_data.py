"""Unit tests for :mod:`app.core.telegram_init_data`.

Exercises every rejection branch of ``verify_init_data`` — the Mini App auth
flow lives or dies on the correctness of these steps, so each failure mode has
its own case.
"""

from __future__ import annotations

import json

import pytest
from app.core.telegram_init_data import (
    InvalidInitData,
    build_init_data_for_tests,
    verify_init_data,
)

_BOT_TOKEN = "1234567890:AAAA-fake-bot-token-for-tests-only"
_MAX_AGE = 24 * 60 * 60


def _signed(auth_date: int, user: dict | None = None, extra: dict | None = None) -> str:
    return build_init_data_for_tests(
        bot_token=_BOT_TOKEN,
        user=user or {"id": 42, "first_name": "Ada", "username": "ada"},
        auth_date=auth_date,
        extra_fields=extra,
    )


def test_valid_init_data_round_trips() -> None:
    now = 1_800_000_000
    raw = _signed(auth_date=now)

    verified = verify_init_data(raw, _BOT_TOKEN, max_age_seconds=_MAX_AGE, now_epoch_seconds=now)

    assert verified.user.id == 42
    assert verified.user.first_name == "Ada"
    assert verified.user.username == "ada"
    assert verified.auth_date == now


def test_tampered_signature_is_rejected() -> None:
    now = 1_800_000_000
    raw = _signed(auth_date=now)
    tampered = raw.replace("hash=", "hash=00")  # corrupt the signature

    with pytest.raises(InvalidInitData, match="signature does not match"):
        verify_init_data(tampered, _BOT_TOKEN, max_age_seconds=_MAX_AGE, now_epoch_seconds=now)


def test_wrong_bot_token_is_rejected() -> None:
    now = 1_800_000_000
    raw = _signed(auth_date=now)

    with pytest.raises(InvalidInitData, match="signature does not match"):
        verify_init_data(
            raw,
            "different-bot-token",
            max_age_seconds=_MAX_AGE,
            now_epoch_seconds=now,
        )


def test_stale_auth_date_is_rejected() -> None:
    signed_at = 1_800_000_000
    now = signed_at + _MAX_AGE + 60
    raw = _signed(auth_date=signed_at)

    with pytest.raises(InvalidInitData, match="stale"):
        verify_init_data(raw, _BOT_TOKEN, max_age_seconds=_MAX_AGE, now_epoch_seconds=now)


def test_future_auth_date_is_rejected() -> None:
    now = 1_800_000_000
    raw = _signed(auth_date=now + 3600)  # 1 h ahead of the clock

    with pytest.raises(InvalidInitData, match="future"):
        verify_init_data(raw, _BOT_TOKEN, max_age_seconds=_MAX_AGE, now_epoch_seconds=now)


def test_empty_input_is_rejected() -> None:
    with pytest.raises(InvalidInitData, match="empty"):
        verify_init_data("", _BOT_TOKEN, max_age_seconds=_MAX_AGE)


def test_missing_hash_is_rejected() -> None:
    with pytest.raises(InvalidInitData, match="hash"):
        verify_init_data(
            "auth_date=1&user=%7B%22id%22%3A1%7D",
            _BOT_TOKEN,
            max_age_seconds=_MAX_AGE,
        )


def test_missing_user_field_is_rejected() -> None:
    now = 1_800_000_000
    # A signed payload but the required `user` field is stripped: caller drops it
    # from the parsed dict, but we build one where user is empty to force it.
    raw = build_init_data_for_tests(
        bot_token=_BOT_TOKEN,
        user={},  # will still get rendered as JSON, so trigger malformed path
        auth_date=now,
    )

    with pytest.raises(InvalidInitData, match="missing `id`"):
        verify_init_data(raw, _BOT_TOKEN, max_age_seconds=_MAX_AGE, now_epoch_seconds=now)


def test_missing_bot_token_is_rejected() -> None:
    now = 1_800_000_000
    raw = _signed(auth_date=now)

    with pytest.raises(InvalidInitData, match="bot token"):
        verify_init_data(raw, "", max_age_seconds=_MAX_AGE, now_epoch_seconds=now)


def test_optional_user_fields_are_preserved() -> None:
    now = 1_800_000_000
    raw = build_init_data_for_tests(
        bot_token=_BOT_TOKEN,
        user={
            "id": 777,
            "first_name": "Grace",
            "last_name": "Hopper",
            "username": "amazing_grace",
            "photo_url": "https://t.me/grace.jpg",
            "language_code": "en",
        },
        auth_date=now,
        extra_fields={"query_id": "abc123", "start_param": "conspectus_42"},
    )

    verified = verify_init_data(raw, _BOT_TOKEN, max_age_seconds=_MAX_AGE, now_epoch_seconds=now)

    assert verified.user.last_name == "Hopper"
    assert verified.user.language_code == "en"
    assert verified.user.photo_url == "https://t.me/grace.jpg"
    assert verified.raw_fields["query_id"] == "abc123"
    assert verified.raw_fields["start_param"] == "conspectus_42"


def test_malformed_user_json_is_rejected() -> None:
    # Sign a payload where `user` field is deliberately not valid JSON: we
    # forge it by injecting a `user` extra_field then re-signing manually.
    now = 1_800_000_000
    # Direct hand-crafted string, then compute the correct HMAC over it so the
    # verifier reaches the JSON decode step and fails there (not on the hash).
    import hashlib
    import hmac
    from urllib.parse import urlencode

    fields = {"auth_date": str(now), "user": "not-json"}
    data_check_string = "\n".join(f"{k}={fields[k]}" for k in sorted(fields))
    secret_key = hmac.new(b"WebAppData", _BOT_TOKEN.encode("utf-8"), hashlib.sha256).digest()
    fields["hash"] = hmac.new(
        secret_key, data_check_string.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    raw = urlencode(fields)

    with pytest.raises(InvalidInitData, match="valid JSON"):
        verify_init_data(raw, _BOT_TOKEN, max_age_seconds=_MAX_AGE, now_epoch_seconds=now)


def test_round_trip_encodes_last_name_with_utf8() -> None:
    """Ensure Cyrillic first/last names round-trip through the signer."""
    now = 1_800_000_000
    raw = _signed(
        auth_date=now,
        user={"id": 1, "first_name": "Иван", "last_name": "Боярков"},
    )

    verified = verify_init_data(raw, _BOT_TOKEN, max_age_seconds=_MAX_AGE, now_epoch_seconds=now)

    assert verified.user.first_name == "Иван"
    assert verified.user.last_name == "Боярков"


def test_signature_field_participates_in_hmac_check_bot_api_7_2() -> None:
    """Bot API 7.2+ adds a `signature` (Ed25519) field for third-party
    validation. Verified on iOS Telegram 9.6: the field IS part of the
    HMAC data-check-string, not excluded from it. Pin the behaviour so a
    future refactor doesn't «helpfully» strip it and break every real
    on-device handshake.
    """
    now = 1_800_000_000
    # Sign a payload that INCLUDES the signature field the way real
    # Telegram does — the signature value is arbitrary here; the HMAC only
    # depends on it being part of the data-check-string.
    raw_with_sig = build_init_data_for_tests(
        bot_token=_BOT_TOKEN,
        user={"id": 42, "first_name": "Ada"},
        auth_date=now,
        extra_fields={"signature": "opaque_ed25519_value_from_telegram"},
    )

    verified = verify_init_data(
        raw_with_sig, _BOT_TOKEN, max_age_seconds=_MAX_AGE, now_epoch_seconds=now
    )

    assert verified.user.id == 42
    # Ensure signature actually reached the verifier's field set (would be
    # gone if we'd stripped it before HMAC).
    assert "signature" in verified.raw_fields


def test_json_dumps_preserves_field_order_between_signer_and_verifier() -> None:
    """Regression pin: signer must feed the same string the verifier reconstructs."""
    now = 1_800_000_000
    user = {"first_name": "Ada", "id": 42, "username": "ada"}
    raw = build_init_data_for_tests(bot_token=_BOT_TOKEN, user=user, auth_date=now)

    verified = verify_init_data(raw, _BOT_TOKEN, max_age_seconds=_MAX_AGE, now_epoch_seconds=now)

    # The verifier reads `user` back as JSON; ordering inside the JSON object
    # doesn't matter because both sides use the same serializer settings.
    _ = json.loads(verified.raw_fields["user"])
    assert verified.user.id == 42
