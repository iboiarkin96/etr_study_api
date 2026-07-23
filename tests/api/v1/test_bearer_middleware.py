"""Integration tests for the Bearer-JWT branch of :func:`app.core.security.authenticate_request`.

The auth middleware is dual-mode during the Mini App rollout: a Bearer JWT
minted at ``POST /api/v1/auth/telegram`` is preferred; the legacy X-API-Key
header still works for internal tools and existing tests.
"""

from __future__ import annotations

import os
import time

from app.core.jwt_tokens import mint_jwt
from app.main import app
from fastapi.testclient import TestClient

_JWT_SECRET = os.environ["JWT_SECRET"]
_PROTECTED_PATH = "/api/v1/conspectuses"


def _bearer_client(token: str) -> TestClient:
    return TestClient(app, headers={"Authorization": f"Bearer {token}"})


def test_valid_bearer_reaches_protected_route() -> None:
    token, _ = mint_jwt(
        subject="00000000-0000-4000-8000-000000000042",
        secret=_JWT_SECRET,
        ttl_seconds=60,
    )
    client = _bearer_client(token)

    response = client.get(_PROTECTED_PATH)

    # 400 = valid auth but the endpoint needs owner query params. Anything
    # other than 401 proves auth passed.
    assert response.status_code != 401, response.text


def test_expired_bearer_returns_401() -> None:
    token, _ = mint_jwt(
        subject="c1",
        secret=_JWT_SECRET,
        ttl_seconds=60,
        now_epoch_seconds=int(time.time()) - 3600,  # minted an hour in the past
    )
    client = _bearer_client(token)

    response = client.get(_PROTECTED_PATH)

    assert response.status_code == 401
    detail = response.json()["detail"]
    assert "expired" in detail["message"].lower()


def test_wrong_signature_bearer_returns_401() -> None:
    token, _ = mint_jwt(subject="c1", secret="different-secret", ttl_seconds=60)
    client = _bearer_client(token)

    response = client.get(_PROTECTED_PATH)

    assert response.status_code == 401
    detail = response.json()["detail"]
    assert "signature" in detail["message"].lower()


def test_malformed_bearer_returns_401() -> None:
    client = _bearer_client("not-a-jwt")

    response = client.get(_PROTECTED_PATH)

    assert response.status_code == 401


def test_bearer_shortcircuits_before_api_key_fallback() -> None:
    """A wrong Bearer must NOT fall through to a valid X-API-Key.

    Prevents credential-confusion attacks where an attacker with a valid API
    key also drops a garbage Bearer to poke at behaviour differences.
    """
    client = TestClient(
        app,
        headers={
            "Authorization": "Bearer garbage.token.here",
            "X-API-Key": "test-api-key",  # valid per conftest
        },
    )

    response = client.get(_PROTECTED_PATH)

    assert response.status_code == 401


def test_missing_credentials_returns_401_with_hint() -> None:
    client = TestClient(app)  # no default headers at all

    response = client.get(_PROTECTED_PATH)

    assert response.status_code == 401
    detail = response.json()["detail"]
    assert "Bearer" in detail["message"]
    assert "X-API-Key" in detail["message"]


def test_x_api_key_fallback_still_works() -> None:
    """Legacy tests + internal tools keep functioning."""
    client = TestClient(app, headers={"X-API-Key": "test-api-key"})

    response = client.get(_PROTECTED_PATH)

    assert response.status_code != 401


def test_live_stays_open_with_no_credentials() -> None:
    client = TestClient(app)
    assert client.get("/live").status_code == 200
    assert client.get("/ready").status_code == 200


def test_auth_endpoint_stays_open_with_no_credentials() -> None:
    client = TestClient(app)
    # We only assert it doesn't 401 on middleware — a 422 from missing body is fine.
    response = client.post("/api/v1/auth/telegram", json={})
    assert response.status_code != 401
