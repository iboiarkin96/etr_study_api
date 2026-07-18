"""HS256 JWT mint + decode helpers.

Hand-rolled against stdlib (`hmac`, `hashlib`, `json`, `base64`) so we do not
add a runtime dependency for a single algorithm. Rejects anything but
``alg=HS256`` at decode time — the ``alg=none`` variant of the JWT confusion
attack is a hard failure here.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass


class InvalidJWT(ValueError):
    """Raised when a JWT is malformed, has a bad signature, or has expired."""


@dataclass(frozen=True)
class JWTPayload:
    """Decoded and verified JWT claims.

    Attributes:
        sub: Subject — ``users.client_uuid`` for authenticated Mini App calls.
        exp: Expiry as unix seconds.
        iat: Issued-at as unix seconds.
        raw: Full JSON dict for callers that need extra claims.
    """

    sub: str
    exp: int
    iat: int
    raw: dict[str, object]


def mint_jwt(
    *,
    subject: str,
    secret: str,
    ttl_seconds: int,
    now_epoch_seconds: int | None = None,
    extra_claims: dict[str, object] | None = None,
) -> tuple[str, int]:
    """Sign a fresh HS256 JWT for ``subject`` and return ``(token, exp_epoch_seconds)``.

    Args:
        subject: Value for the ``sub`` claim (typically ``users.client_uuid``).
        secret: HMAC key. Callers must pass a value ≥ 32 bytes in qa/prod;
            the config guard enforces this at startup.
        ttl_seconds: Token lifetime; ``exp`` is set to ``now + ttl_seconds``.
        now_epoch_seconds: Injected clock; defaults to ``time.time()``.
        extra_claims: Optional additional claims (must not include ``sub``,
            ``exp``, ``iat`` — those are set by this function).

    Returns:
        Tuple ``(compact_jwt_string, expiry_epoch_seconds)``.
    """
    now = int(now_epoch_seconds if now_epoch_seconds is not None else time.time())
    exp = now + ttl_seconds
    claims: dict[str, object] = {"sub": subject, "iat": now, "exp": exp}
    if extra_claims:
        for reserved in ("sub", "iat", "exp"):
            if reserved in extra_claims:
                raise ValueError(f"extra_claims must not override {reserved!r}")
        claims.update(extra_claims)

    header = {"alg": "HS256", "typ": "JWT"}
    header_segment = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_segment = _b64url_encode(json.dumps(claims, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
    signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    signature_segment = _b64url_encode(signature)
    return f"{header_segment}.{payload_segment}.{signature_segment}", exp


def decode_jwt(
    token: str,
    *,
    secret: str,
    now_epoch_seconds: int | None = None,
) -> JWTPayload:
    """Verify and decode ``token``; raise :class:`InvalidJWT` on any failure.

    Args:
        token: Compact JWT (three ``.``-separated base64url segments).
        secret: Same HMAC key that was used at mint time.
        now_epoch_seconds: Injected clock; defaults to ``time.time()``.

    Returns:
        :class:`JWTPayload` with the ``sub`` / ``exp`` / ``iat`` claims.

    Raises:
        InvalidJWT: Malformed structure, unsupported ``alg``, bad signature,
            missing required claims, or an expired token.
    """
    if not token or token.count(".") != 2:
        raise InvalidJWT("token is not a compact JWT")
    header_b64, payload_b64, signature_b64 = token.split(".")
    try:
        header = json.loads(_b64url_decode(header_b64))
    except (json.JSONDecodeError, ValueError) as exc:
        raise InvalidJWT(f"header is not valid JSON: {exc}") from exc
    if not isinstance(header, dict) or header.get("alg") != "HS256":
        raise InvalidJWT("unsupported alg (only HS256 is accepted)")

    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected_signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    try:
        provided_signature = _b64url_decode(signature_b64)
    except ValueError as exc:
        raise InvalidJWT(f"signature is not valid base64url: {exc}") from exc
    if not hmac.compare_digest(expected_signature, provided_signature):
        raise InvalidJWT("signature does not match")

    try:
        payload_raw = json.loads(_b64url_decode(payload_b64))
    except (json.JSONDecodeError, ValueError) as exc:
        raise InvalidJWT(f"payload is not valid JSON: {exc}") from exc
    if not isinstance(payload_raw, dict):
        raise InvalidJWT("payload is not a JSON object")

    sub = payload_raw.get("sub")
    exp = payload_raw.get("exp")
    iat = payload_raw.get("iat")
    if not isinstance(sub, str) or not sub:
        raise InvalidJWT("payload is missing `sub`")
    if not isinstance(exp, int):
        raise InvalidJWT("payload is missing `exp`")
    if not isinstance(iat, int):
        raise InvalidJWT("payload is missing `iat`")

    now = int(now_epoch_seconds if now_epoch_seconds is not None else time.time())
    if now >= exp:
        raise InvalidJWT("token has expired")

    return JWTPayload(sub=sub, exp=exp, iat=iat, raw=payload_raw)


def _b64url_encode(data: bytes) -> str:
    """Encode ``data`` as base64url without ``=`` padding (JWT convention)."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(segment: str) -> bytes:
    """Decode a base64url segment, re-padding as required.

    Raises:
        ValueError: Segment contains non-base64url characters or malformed padding.
    """
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)
