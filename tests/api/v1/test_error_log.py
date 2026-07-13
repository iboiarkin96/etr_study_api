"""Tests for POST /api/v1/errors and GET /api/v1/errors."""

from __future__ import annotations

from tests.api.v1.user_test_utils import (
    TEST_SYSTEM_UUID,
    TEST_SYSTEM_UUID_ALT,
    USER_HTTP_BASE_PATH,
    user_create_body,
)

ERRORS_HTTP_BASE_PATH = "/api/v1/errors"


def _seed_user(client, system_user_id: str, *, system_uuid: str = TEST_SYSTEM_UUID) -> str:
    """Create a user and return their internal ``client_uuid`` (unused by callers, kept for parity)."""
    response = client.post(
        USER_HTTP_BASE_PATH,
        json=user_create_body(system_user_id, system_uuid=system_uuid),
        headers={"Idempotency-Key": f"seed-user-{system_user_id}"},
    )
    assert response.status_code == 201, response.json()
    return response.json()["client_uuid"]


def test_create_error_log_success(client) -> None:
    _seed_user(client, "err-log-user-1")

    response = client.post(
        ERRORS_HTTP_BASE_PATH,
        json={
            "system_user_id": "err-log-user-1",
            "system_uuid": TEST_SYSTEM_UUID,
            "message": "I mixed up ETR terms",
        },
        headers={"Idempotency-Key": "err-log-create-1"},
    )

    assert response.status_code == 201, response.json()
    body = response.json()
    assert body["message"] == "I mixed up ETR terms"
    assert body["conspectus_uuid"] is None
    assert body["review_log_id"] is None
    assert "error_uuid" in body
    assert "created_at" in body


def test_create_error_log_idempotent_replay(client) -> None:
    _seed_user(client, "err-log-user-2")
    body = {
        "system_user_id": "err-log-user-2",
        "system_uuid": TEST_SYSTEM_UUID,
        "message": "  trailing space  ",
    }

    first = client.post(
        ERRORS_HTTP_BASE_PATH,
        json=body,
        headers={"Idempotency-Key": "err-log-replay-1"},
    )
    second = client.post(
        ERRORS_HTTP_BASE_PATH,
        json=body,
        headers={"Idempotency-Key": "err-log-replay-1"},
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["error_uuid"] == second.json()["error_uuid"]
    assert first.json()["message"] == "trailing space"


def test_create_error_log_idempotency_conflict(client) -> None:
    _seed_user(client, "err-log-user-3")

    first = client.post(
        ERRORS_HTTP_BASE_PATH,
        json={
            "system_user_id": "err-log-user-3",
            "system_uuid": TEST_SYSTEM_UUID,
            "message": "first",
        },
        headers={"Idempotency-Key": "err-log-conflict-1"},
    )
    second = client.post(
        ERRORS_HTTP_BASE_PATH,
        json={
            "system_user_id": "err-log-user-3",
            "system_uuid": TEST_SYSTEM_UUID,
            "message": "second",
        },
        headers={"Idempotency-Key": "err-log-conflict-1"},
    )

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["detail"]["code"] == "COMMON_409"


def test_create_error_log_user_not_found(client) -> None:
    response = client.post(
        ERRORS_HTTP_BASE_PATH,
        json={
            "system_user_id": "nonexistent",
            "system_uuid": TEST_SYSTEM_UUID,
            "message": "hello",
        },
        headers={"Idempotency-Key": "err-log-nouser-1"},
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "USER_404"


def test_create_error_log_empty_message_rejected(client) -> None:
    _seed_user(client, "err-log-user-4")

    response = client.post(
        ERRORS_HTTP_BASE_PATH,
        json={
            "system_user_id": "err-log-user-4",
            "system_uuid": TEST_SYSTEM_UUID,
            "message": "   ",
        },
        headers={"Idempotency-Key": "err-log-empty-1"},
    )

    assert response.status_code == 422


def test_list_error_logs_owner_scoped(client) -> None:
    _seed_user(client, "err-log-owner-a", system_uuid=TEST_SYSTEM_UUID)
    _seed_user(client, "err-log-owner-b", system_uuid=TEST_SYSTEM_UUID_ALT)

    client.post(
        ERRORS_HTTP_BASE_PATH,
        json={
            "system_user_id": "err-log-owner-a",
            "system_uuid": TEST_SYSTEM_UUID,
            "message": "note A-1",
        },
        headers={"Idempotency-Key": "err-log-list-a1"},
    )
    client.post(
        ERRORS_HTTP_BASE_PATH,
        json={
            "system_user_id": "err-log-owner-b",
            "system_uuid": TEST_SYSTEM_UUID_ALT,
            "message": "note B-1",
        },
        headers={"Idempotency-Key": "err-log-list-b1"},
    )

    response = client.get(
        ERRORS_HTTP_BASE_PATH,
        params={
            "system_user_id": "err-log-owner-a",
            "system_uuid": TEST_SYSTEM_UUID,
        },
    )

    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    assert items[0]["message"] == "note A-1"


def test_list_error_logs_user_not_found(client) -> None:
    response = client.get(
        ERRORS_HTTP_BASE_PATH,
        params={
            "system_user_id": "does-not-exist",
            "system_uuid": TEST_SYSTEM_UUID,
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "USER_404"


def _create_conspectus(
    client,
    system_user_id: str,
    idem: str,
    *,
    system_uuid: str = TEST_SYSTEM_UUID,
) -> str:
    """Seed one conspectus for the given learner and return its uuid."""
    response = client.post(
        "/api/v1/conspectuses",
        json={
            "system_user_id": system_user_id,
            "system_uuid": system_uuid,
            "title": "note",
            "cue_sheet": {"terms": ["a"]},
            "dense_paragraph": "body",
            "bullets": ["one"],
        },
        headers={"Idempotency-Key": idem},
    )
    assert response.status_code == 201, response.json()
    return response.json()["conspectus_uuid"]


def test_create_error_log_conspectus_ref_not_owned(client) -> None:
    _seed_user(client, "err-log-fk-a")
    _seed_user(client, "err-log-fk-b", system_uuid=TEST_SYSTEM_UUID_ALT)
    foreign_conspectus_uuid = _create_conspectus(
        client, "err-log-fk-b", "seed-cn-fk-b", system_uuid=TEST_SYSTEM_UUID_ALT
    )

    response = client.post(
        ERRORS_HTTP_BASE_PATH,
        json={
            "system_user_id": "err-log-fk-a",
            "system_uuid": TEST_SYSTEM_UUID,
            "message": "linked to note that isn't mine",
            "conspectus_uuid": foreign_conspectus_uuid,
        },
        headers={"Idempotency-Key": "err-log-fk-conspectus-1"},
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "ERR_404"


def test_create_error_log_review_log_ref_not_owned(client) -> None:
    _seed_user(client, "err-log-rlog")

    response = client.post(
        ERRORS_HTTP_BASE_PATH,
        json={
            "system_user_id": "err-log-rlog",
            "system_uuid": TEST_SYSTEM_UUID,
            "message": "linked to a review log that does not exist",
            "review_log_id": 999999,
        },
        headers={"Idempotency-Key": "err-log-fk-rlog-1"},
    )

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "ERR_404"


def test_create_error_log_with_owned_conspectus_ref(client) -> None:
    _seed_user(client, "err-log-owned")
    conspectus_uuid = _create_conspectus(client, "err-log-owned", "seed-cn-owned")

    response = client.post(
        ERRORS_HTTP_BASE_PATH,
        json={
            "system_user_id": "err-log-owned",
            "system_uuid": TEST_SYSTEM_UUID,
            "message": "linked to my own note",
            "conspectus_uuid": conspectus_uuid,
        },
        headers={"Idempotency-Key": "err-log-owned-1"},
    )

    assert response.status_code == 201
    assert response.json()["conspectus_uuid"] == conspectus_uuid


def test_create_error_log_missing_message_returns_err_code(client) -> None:
    """POST /errors without message → 422 with ERR_005 stable code."""
    _seed_user(client, "err-code-1")
    resp = client.post(
        ERRORS_HTTP_BASE_PATH,
        json={
            "system_user_id": "err-code-1",
            "system_uuid": TEST_SYSTEM_UUID,
        },
        headers={"Idempotency-Key": "err-code-1"},
    )

    assert resp.status_code == 422
    codes = {err["code"] for err in resp.json()["errors"]}
    assert "ERR_005" in codes


def test_create_error_log_bad_conspectus_uuid_returns_err_code(client) -> None:
    """conspectus_uuid that isn't a UUID → 422 ERR_008."""
    _seed_user(client, "err-code-2")
    resp = client.post(
        ERRORS_HTTP_BASE_PATH,
        json={
            "system_user_id": "err-code-2",
            "system_uuid": TEST_SYSTEM_UUID,
            "message": "hi",
            "conspectus_uuid": "not-a-uuid",
        },
        headers={"Idempotency-Key": "err-code-2"},
    )

    assert resp.status_code == 422
    codes = {err["code"] for err in resp.json()["errors"]}
    assert "ERR_008" in codes


def test_list_error_logs_filter_by_conspectus_uuid(client) -> None:
    _seed_user(client, "err-log-filter")
    linked_uuid = _create_conspectus(client, "err-log-filter", "seed-cn-filter")

    # One linked, one standalone
    client.post(
        ERRORS_HTTP_BASE_PATH,
        json={
            "system_user_id": "err-log-filter",
            "system_uuid": TEST_SYSTEM_UUID,
            "message": "linked",
            "conspectus_uuid": linked_uuid,
        },
        headers={"Idempotency-Key": "err-log-filter-linked"},
    )
    client.post(
        ERRORS_HTTP_BASE_PATH,
        json={
            "system_user_id": "err-log-filter",
            "system_uuid": TEST_SYSTEM_UUID,
            "message": "standalone",
        },
        headers={"Idempotency-Key": "err-log-filter-standalone"},
    )

    filtered = client.get(
        ERRORS_HTTP_BASE_PATH,
        params={
            "system_user_id": "err-log-filter",
            "system_uuid": TEST_SYSTEM_UUID,
            "conspectus_uuid": linked_uuid,
        },
    ).json()

    assert [item["message"] for item in filtered] == ["linked"]
