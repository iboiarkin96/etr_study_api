"""Tests for GET /api/v1/schedule/summary and /preview."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.core.database import SessionLocal
from app.models.core.conspectus import Conspectus, ConspectusSchedule
from app.models.core.user import User

from tests.api.v1.user_test_utils import (
    TEST_SYSTEM_UUID,
    USER_HTTP_BASE_PATH,
    user_create_body,
)

SCHEDULE_SUMMARY_PATH = "/api/v1/schedule/summary"
SCHEDULE_PREVIEW_PATH = "/api/v1/schedule/preview"


def _seed_user(client, system_user_id: str) -> str:
    response = client.post(
        USER_HTTP_BASE_PATH,
        json=user_create_body(system_user_id),
        headers={"Idempotency-Key": f"seed-{system_user_id}"},
    )
    assert response.status_code == 201, response.json()
    return response.json()["client_uuid"]


def _seed_schedule_row(
    *,
    owner_client_uuid: str,
    slot: str,
    next_review_at: datetime,
    title: str,
) -> str:
    """Insert one conspectuses + one conspectus_schedules row directly and return the uuid."""
    conspectus_uuid = str(uuid4())
    now = datetime.now(UTC)
    with SessionLocal() as session:
        session.add(
            Conspectus(
                conspectus_uuid=conspectus_uuid,
                owner_client_uuid=owner_client_uuid,
                title=title,
                cue_sheet={"terms": []},
                cue_sheet_schema_version=1,
                dense_paragraph="body",
                bullets=["a"],
                content_version=1,
                created_at=now,
                updated_at=now,
                is_row_invalid=0,
            )
        )
        session.add(
            ConspectusSchedule(
                conspectus_uuid=conspectus_uuid,
                owner_client_uuid=owner_client_uuid,
                slot=slot,
                slot_d_ladder_index=0,
                next_review_at=next_review_at,
                schedule_revision=1,
                schedule_policy_id="etr_methodology_four_slot",
                schedule_policy_version="1.0.0",
                algorithm_version="v1",
                schedule_updated_at=now,
                is_row_invalid=0,
            )
        )
        session.commit()
    return conspectus_uuid


def _resolve_owner_client_uuid(system_user_id: str) -> str:
    with SessionLocal() as session:
        row = session.query(User).filter(User.system_user_id == system_user_id).one()
        return row.client_uuid


def test_schedule_summary_zero_when_empty(client) -> None:
    _seed_user(client, "sched-empty")

    response = client.get(
        SCHEDULE_SUMMARY_PATH,
        params={"system_user_id": "sched-empty", "system_uuid": TEST_SYSTEM_UUID},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["by_slot"] == {"A": 0, "B": 0, "C": 0, "D": 0}
    assert body["total"] == 0
    assert body["due_now"] == 0
    assert body["due_next_24h"] == 0


def test_schedule_summary_counts_by_slot(client) -> None:
    _seed_user(client, "sched-mixed")
    owner = _resolve_owner_client_uuid("sched-mixed")
    now = datetime.now(UTC)
    _seed_schedule_row(
        owner_client_uuid=owner, slot="A", next_review_at=now - timedelta(minutes=5), title="a1"
    )
    _seed_schedule_row(
        owner_client_uuid=owner, slot="A", next_review_at=now + timedelta(hours=2), title="a2"
    )
    _seed_schedule_row(
        owner_client_uuid=owner, slot="C", next_review_at=now + timedelta(days=2), title="c1"
    )

    response = client.get(
        SCHEDULE_SUMMARY_PATH,
        params={"system_user_id": "sched-mixed", "system_uuid": TEST_SYSTEM_UUID},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["by_slot"] == {"A": 2, "B": 0, "C": 1, "D": 0}
    assert body["total"] == 3
    assert body["due_now"] == 1
    assert body["due_next_24h"] == 1


def test_schedule_summary_user_not_found(client) -> None:
    response = client.get(
        SCHEDULE_SUMMARY_PATH,
        params={"system_user_id": "no-such", "system_uuid": TEST_SYSTEM_UUID},
    )
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "USER_404"


def test_schedule_preview_returns_items_within_window(client) -> None:
    _seed_user(client, "sched-preview")
    owner = _resolve_owner_client_uuid("sched-preview")
    now = datetime.now(UTC)
    _seed_schedule_row(
        owner_client_uuid=owner, slot="A", next_review_at=now + timedelta(hours=1), title="in-1h"
    )
    _seed_schedule_row(
        owner_client_uuid=owner, slot="B", next_review_at=now + timedelta(hours=3), title="in-3h"
    )
    _seed_schedule_row(
        owner_client_uuid=owner, slot="C", next_review_at=now + timedelta(days=5), title="in-5d"
    )

    response = client.get(
        SCHEDULE_PREVIEW_PATH,
        params={
            "system_user_id": "sched-preview",
            "system_uuid": TEST_SYSTEM_UUID,
            "window": "PT4H",
            "limit": 20,
            "random_seed": "seed-abc-123",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["window"] == "PT4H"
    assert body["random_seed"] == "seed-abc-123"
    titles = [item["title"] for item in body["items"]]
    assert set(titles) == {"in-1h", "in-3h"}
    assert body["count"] == 2


def test_schedule_preview_deterministic_within_minute(client) -> None:
    _seed_user(client, "sched-det")
    owner = _resolve_owner_client_uuid("sched-det")
    now = datetime.now(UTC)
    for i in range(4):
        _seed_schedule_row(
            owner_client_uuid=owner,
            slot="A",
            next_review_at=now + timedelta(minutes=i * 10),
            title=f"item-{i}",
        )

    params = {
        "system_user_id": "sched-det",
        "system_uuid": TEST_SYSTEM_UUID,
        "window": "PT4H",
        "random_seed": "stable-seed",
    }
    first = client.get(SCHEDULE_PREVIEW_PATH, params=params).json()
    second = client.get(SCHEDULE_PREVIEW_PATH, params=params).json()

    assert [item["conspectus_uuid"] for item in first["items"]] == [
        item["conspectus_uuid"] for item in second["items"]
    ]


def test_schedule_preview_generates_seed_when_missing(client) -> None:
    _seed_user(client, "sched-noseed")

    response = client.get(
        SCHEDULE_PREVIEW_PATH,
        params={"system_user_id": "sched-noseed", "system_uuid": TEST_SYSTEM_UUID},
    )

    assert response.status_code == 200
    seed = response.json()["random_seed"]
    assert seed
    assert 1 <= len(seed) <= 64


def test_schedule_preview_invalid_window_422(client) -> None:
    _seed_user(client, "sched-badwin")
    response = client.get(
        SCHEDULE_PREVIEW_PATH,
        params={
            "system_user_id": "sched-badwin",
            "system_uuid": TEST_SYSTEM_UUID,
            "window": "PT12H",
        },
    )
    assert response.status_code == 422


def test_schedule_preview_truncates_to_limit(client) -> None:
    _seed_user(client, "sched-limit")
    owner = _resolve_owner_client_uuid("sched-limit")
    now = datetime.now(UTC)
    for i in range(5):
        _seed_schedule_row(
            owner_client_uuid=owner,
            slot="A",
            next_review_at=now + timedelta(minutes=i * 5),
            title=f"item-{i}",
        )

    response = client.get(
        SCHEDULE_PREVIEW_PATH,
        params={
            "system_user_id": "sched-limit",
            "system_uuid": TEST_SYSTEM_UUID,
            "window": "PT4H",
            "limit": 3,
            "random_seed": "limit-seed",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 3
    assert len(body["items"]) == 3
    assert {item["preview_order_index"] for item in body["items"]} == {0, 1, 2}


def test_schedule_preview_bad_window_returns_sched_code(client) -> None:
    """GET /schedule/preview with wrong window enum → 422 SCHED_010."""
    _seed_user(client, "sched-code-1")
    resp = client.get(
        SCHEDULE_PREVIEW_PATH,
        params={
            "system_user_id": "sched-code-1",
            "system_uuid": TEST_SYSTEM_UUID,
            "window": "PT12H",
        },
    )

    assert resp.status_code == 422
    codes = {err["code"] for err in resp.json()["errors"]}
    assert "SCHED_010" in codes


def test_schedule_summary_missing_uuid_returns_sched_code(client) -> None:
    """Missing system_uuid query param → 422 SCHED_003."""
    resp = client.get(
        SCHEDULE_SUMMARY_PATH,
        params={"system_user_id": "sched-code-2"},
    )

    assert resp.status_code == 422
    codes = {err["code"] for err in resp.json()["errors"]}
    assert "SCHED_003" in codes


def test_schedule_preview_bad_seed_returns_422(client) -> None:
    _seed_user(client, "sched-badseed")
    response = client.get(
        SCHEDULE_PREVIEW_PATH,
        params={
            "system_user_id": "sched-badseed",
            "system_uuid": TEST_SYSTEM_UUID,
            "random_seed": "spaces are not allowed",
        },
    )
    assert response.status_code == 422
