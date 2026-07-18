"""Integration tests for ``POST /api/v1/auth/telegram``."""

from __future__ import annotations

import os
import time

from app.core.database import SessionLocal
from app.core.jwt_tokens import decode_jwt
from app.core.telegram_identity import TELEGRAM_SYSTEM_UUID
from app.core.telegram_init_data import build_init_data_for_tests
from app.main import app
from fastapi.testclient import TestClient
from sqlalchemy import text

_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
_JWT_SECRET = os.environ["JWT_SECRET"]

_AUTH_PATH = "/api/v1/auth/telegram"


def _make_client_without_api_key() -> TestClient:
    """Prove the endpoint is anonymous — no `X-API-Key` header set."""
    return TestClient(app)


def _valid_init_data(
    *,
    user_id: int = 111222333,
    username: str | None = "ada",
    first_name: str = "Ada",
    last_name: str | None = "Lovelace",
    photo_url: str | None = "https://t.me/ada.jpg",
    language_code: str | None = "en",
    auth_date: int | None = None,
) -> str:
    user: dict[str, object] = {"id": user_id, "first_name": first_name}
    if last_name is not None:
        user["last_name"] = last_name
    if username is not None:
        user["username"] = username
    if photo_url is not None:
        user["photo_url"] = photo_url
    if language_code is not None:
        user["language_code"] = language_code
    return build_init_data_for_tests(
        bot_token=_BOT_TOKEN,
        user=user,
        auth_date=auth_date if auth_date is not None else int(time.time()),
    )


def test_valid_init_data_returns_jwt_and_creates_rows() -> None:
    client = _make_client_without_api_key()

    response = client.post(_AUTH_PATH, json={"init_data": _valid_init_data()})

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["token_type"] == "Bearer"
    assert body["expires_at_epoch"] > int(time.time())
    assert body["user"]["telegram_user_id"] == 111222333
    assert body["user"]["telegram_username"] == "ada"
    assert body["user"]["full_name"] == "Ada Lovelace"

    decoded = decode_jwt(body["jwt"], secret=_JWT_SECRET)
    assert decoded.sub == body["user"]["client_uuid"]

    with SessionLocal() as session:
        row = session.execute(
            text("SELECT client_uuid FROM telegram_users WHERE telegram_user_id = 111222333"),
        ).first()
        assert row is not None
        assert row[0] == body["user"]["client_uuid"]

        user_row = session.execute(
            text(
                "SELECT system_uuid, system_user_id, full_name FROM users WHERE client_uuid = :cu"
            ),
            {"cu": body["user"]["client_uuid"]},
        ).first()
        assert user_row is not None
        assert user_row[0] == TELEGRAM_SYSTEM_UUID
        assert user_row[1] == "111222333"
        assert user_row[2] == "Ada Lovelace"


def test_repeated_login_upserts_and_refreshes_profile() -> None:
    client = _make_client_without_api_key()

    first = client.post(_AUTH_PATH, json={"init_data": _valid_init_data()})
    assert first.status_code == 200
    first_body = first.json()

    # Second call — the SAME telegram_user_id but a new username and photo.
    second_raw = _valid_init_data(
        username="ada_bytes",
        photo_url="https://t.me/ada2.jpg",
        language_code="ru",
    )
    second = client.post(_AUTH_PATH, json={"init_data": second_raw})
    assert second.status_code == 200
    second_body = second.json()

    assert second_body["user"]["client_uuid"] == first_body["user"]["client_uuid"]
    assert second_body["user"]["telegram_username"] == "ada_bytes"
    assert second_body["user"]["locale"] == "ru"
    assert second_body["user"]["telegram_photo_url"] == "https://t.me/ada2.jpg"


def test_tampered_init_data_returns_401() -> None:
    client = _make_client_without_api_key()
    raw = _valid_init_data()
    tampered = raw.replace("hash=", "hash=00")

    response = client.post(_AUTH_PATH, json={"init_data": tampered})

    assert response.status_code == 401
    detail = response.json()["detail"]
    assert detail["code"] == "COMMON_401"


def test_stale_auth_date_returns_401() -> None:
    client = _make_client_without_api_key()
    raw = _valid_init_data(auth_date=int(time.time()) - 48 * 60 * 60)

    response = client.post(_AUTH_PATH, json={"init_data": raw})

    assert response.status_code == 401


def test_endpoint_stays_anonymous_without_api_key_header() -> None:
    """The auth endpoint must not require the existing X-API-Key middleware."""
    client = TestClient(app)  # explicitly no default headers
    response = client.post(_AUTH_PATH, json={"init_data": _valid_init_data()})

    assert response.status_code == 200


def test_missing_body_returns_422() -> None:
    client = _make_client_without_api_key()
    response = client.post(_AUTH_PATH, json={})
    assert response.status_code == 422


def test_first_name_only_users_get_that_as_full_name() -> None:
    client = _make_client_without_api_key()
    raw = _valid_init_data(
        user_id=999999,
        first_name="Solo",
        last_name=None,
        username=None,
        photo_url=None,
        language_code=None,
    )

    response = client.post(_AUTH_PATH, json={"init_data": raw})

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["full_name"] == "Solo"
    assert body["user"]["telegram_username"] is None
