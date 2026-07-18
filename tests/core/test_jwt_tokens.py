"""Unit tests for :mod:`app.core.jwt_tokens`."""

from __future__ import annotations

import pytest
from app.core.jwt_tokens import InvalidJWT, decode_jwt, mint_jwt

_SECRET = "unit-test-jwt-secret-at-least-32-bytes-long"


def test_mint_and_decode_round_trip() -> None:
    token, exp = mint_jwt(
        subject="client-uuid-1",
        secret=_SECRET,
        ttl_seconds=3600,
        now_epoch_seconds=1_800_000_000,
    )

    decoded = decode_jwt(token, secret=_SECRET, now_epoch_seconds=1_800_000_000)

    assert decoded.sub == "client-uuid-1"
    assert decoded.exp == exp
    assert exp == 1_800_000_000 + 3600
    assert decoded.iat == 1_800_000_000


def test_extra_claims_survive_the_round_trip() -> None:
    token, _ = mint_jwt(
        subject="c1",
        secret=_SECRET,
        ttl_seconds=60,
        now_epoch_seconds=1_800_000_000,
        extra_claims={"role": "learner", "tg_id": 12345},
    )

    decoded = decode_jwt(token, secret=_SECRET, now_epoch_seconds=1_800_000_000)

    assert decoded.raw["role"] == "learner"
    assert decoded.raw["tg_id"] == 12345


def test_extra_claims_cannot_override_reserved_fields() -> None:
    with pytest.raises(ValueError, match="sub"):
        mint_jwt(
            subject="c1",
            secret=_SECRET,
            ttl_seconds=60,
            extra_claims={"sub": "attacker"},
        )


def test_expired_token_is_rejected() -> None:
    token, _ = mint_jwt(
        subject="c1",
        secret=_SECRET,
        ttl_seconds=60,
        now_epoch_seconds=1_800_000_000,
    )

    with pytest.raises(InvalidJWT, match="expired"):
        decode_jwt(token, secret=_SECRET, now_epoch_seconds=1_800_000_000 + 3600)


def test_wrong_secret_is_rejected() -> None:
    token, _ = mint_jwt(subject="c1", secret=_SECRET, ttl_seconds=60)

    with pytest.raises(InvalidJWT, match="signature"):
        decode_jwt(token, secret="different-secret")


def test_malformed_token_is_rejected() -> None:
    with pytest.raises(InvalidJWT):
        decode_jwt("not.a.jwt.at.all", secret=_SECRET)
    with pytest.raises(InvalidJWT):
        decode_jwt("only-one-segment", secret=_SECRET)


def test_alg_none_attack_is_rejected() -> None:
    """A token with `alg=none` must never verify."""
    import base64
    import json

    header = {"alg": "none", "typ": "JWT"}
    payload = {"sub": "attacker", "exp": 9999999999, "iat": 1_800_000_000}

    def _b64(x: bytes) -> str:
        return base64.urlsafe_b64encode(x).rstrip(b"=").decode()

    forged = f"{_b64(json.dumps(header).encode())}.{_b64(json.dumps(payload).encode())}."

    with pytest.raises(InvalidJWT, match="alg"):
        decode_jwt(forged, secret=_SECRET)
