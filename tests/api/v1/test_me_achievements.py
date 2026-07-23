"""Tests for GET /api/v1/me/achievements (computed achievement set, T-23)."""

from __future__ import annotations

from typing import Any

from tests.api.v1.user_test_utils import (
    TEST_SYSTEM_UUID,
    USER_HTTP_BASE_PATH,
    user_create_body,
)

ME_ACH_PATH = "/api/v1/me/achievements"
CONS_HTTP_BASE_PATH = "/api/v1/conspectuses"

EXPECTED_KEYS = [
    "first_review",
    "streak_7",
    "streak_30",
    "reviews_100",
    "notes_10",
    "noticer_10",
    "perfect_day",
    "comeback",
    "early_bird",
    "night_owl",
    "mastery_50",
    "reviews_500",
]

BINARY_KEYS = ["perfect_day", "comeback", "early_bird", "night_owl"]


def _seed_user(client, system_user_id: str) -> str:
    response = client.post(
        USER_HTTP_BASE_PATH,
        json=user_create_body(system_user_id),
        headers={"Idempotency-Key": f"seed-{system_user_id}"},
    )
    assert response.status_code == 201, response.json()
    return response.json()["client_uuid"]


def _create_conspectus(client, system_user_id: str, idem: str, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "system_user_id": system_user_id,
        "system_uuid": TEST_SYSTEM_UUID,
        "title": "Note",
        "cue_sheet": {"terms": ["a"], "questions": ["q?"]},
        "dense_paragraph": "Dense paragraph.",
        "bullets": ["one"],
    }
    body.update(overrides)
    resp = client.post(CONS_HTTP_BASE_PATH, json=body, headers={"Idempotency-Key": idem})
    assert resp.status_code == 201, resp.json()
    return resp.json()


def _params(system_user_id: str) -> dict[str, str]:
    return {"system_user_id": system_user_id, "system_uuid": TEST_SYSTEM_UUID}


def test_achievements_fresh_user_all_locked(client) -> None:
    sid = "ach-fresh"
    _seed_user(client, sid)

    resp = client.get(ME_ACH_PATH, params=_params(sid))

    assert resp.status_code == 200
    body = resp.json()
    assert [i["key"] for i in body["items"]] == EXPECTED_KEYS
    assert all(i["unlocked"] is False for i in body["items"])
    assert all(i["progress"] == 0 for i in body["items"])
    assert body["computed_at"]


def test_achievements_first_review_unlocks(client) -> None:
    sid = "ach-first"
    _seed_user(client, sid)
    created = _create_conspectus(client, sid, "ach-first-cn")
    resp = client.post(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/actions/review",
        json={"system_user_id": sid, "system_uuid": TEST_SYSTEM_UUID, "tag": "easy"},
        headers={"Idempotency-Key": "ach-first-rev"},
    )
    assert resp.status_code == 200

    body = client.get(ME_ACH_PATH, params=_params(sid)).json()
    by_key = {i["key"]: i for i in body["items"]}

    assert by_key["first_review"]["unlocked"] is True
    assert by_key["first_review"]["progress"] == 1
    # One review today = a 1-day streak; 7-day badge shows progress 1/7.
    assert by_key["streak_7"]["unlocked"] is False
    assert by_key["streak_7"]["progress"] == 1
    assert by_key["notes_10"]["progress"] == 1


def test_achievements_noticer_counts_misses(client) -> None:
    sid = "ach-miss"
    _seed_user(client, sid)
    for n in range(3):
        resp = client.post(
            "/api/v1/errors",
            json={
                "system_user_id": sid,
                "system_uuid": TEST_SYSTEM_UUID,
                "message": f"miss {n}",
            },
            headers={"Idempotency-Key": f"ach-miss-{n}"},
        )
        assert resp.status_code == 201, resp.json()

    body = client.get(ME_ACH_PATH, params=_params(sid)).json()
    by_key = {i["key"]: i for i in body["items"]}

    assert by_key["noticer_10"]["progress"] == 3
    assert by_key["noticer_10"]["unlocked"] is False
    assert by_key["noticer_10"]["target"] == 10


def test_achievements_progress_clamped_to_target(client) -> None:
    sid = "ach-clamp"
    _seed_user(client, sid)
    created = _create_conspectus(client, sid, "ach-clamp-cn")
    # Two reviews of the same card: progress toward first_review (target 1)
    # must clamp at 1, not report 2.
    for n in range(2):
        resp = client.post(
            f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/actions/review",
            json={"system_user_id": sid, "system_uuid": TEST_SYSTEM_UUID, "tag": "easy"},
            headers={"Idempotency-Key": f"ach-clamp-rev-{n}"},
        )
        assert resp.status_code == 200, resp.json()

    body = client.get(ME_ACH_PATH, params=_params(sid)).json()
    by_key = {i["key"]: i for i in body["items"]}

    assert by_key["first_review"]["progress"] == 1
    assert by_key["reviews_100"]["progress"] == 2


def test_achievements_binary_badges_have_target_one(client) -> None:
    sid = "ach-binary"
    _seed_user(client, sid)

    body = client.get(ME_ACH_PATH, params=_params(sid)).json()
    by_key = {i["key"]: i for i in body["items"]}

    for key in BINARY_KEYS:
        assert by_key[key]["target"] == 1
        assert by_key[key]["progress"] in (0, 1)
    # Fresh account: perfect_day / comeback are definitively locked.
    assert by_key["perfect_day"]["unlocked"] is False
    assert by_key["comeback"]["unlocked"] is False


def test_achievements_mastery_counts_easy_reviews(client) -> None:
    sid = "ach-mastery"
    _seed_user(client, sid)
    created = _create_conspectus(client, sid, "ach-mastery-cn")
    resp = client.post(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/actions/review",
        json={"system_user_id": sid, "system_uuid": TEST_SYSTEM_UUID, "tag": "easy"},
        headers={"Idempotency-Key": "ach-mastery-rev"},
    )
    assert resp.status_code == 200

    body = client.get(ME_ACH_PATH, params=_params(sid)).json()
    by_key = {i["key"]: i for i in body["items"]}

    assert by_key["mastery_50"]["progress"] == 1
    assert by_key["mastery_50"]["target"] == 50
    assert by_key["reviews_500"]["progress"] == 1


def test_has_comeback_pure_rules() -> None:
    from datetime import date, timedelta

    from app.services.me_service import _has_comeback

    d0 = date(2026, 7, 1)
    active = {d0: 1, d0 + timedelta(days=8): 2}
    assert _has_comeback(active, gap_days=7) is True
    # 6-day gap is not a comeback yet.
    dense = {d0: 1, d0 + timedelta(days=6): 2}
    assert _has_comeback(dense, gap_days=7) is False
    # Zero-count days are not «active» and cannot anchor a gap.
    with_zero = {d0: 1, d0 + timedelta(days=8): 0}
    assert _has_comeback(with_zero, gap_days=7) is False
    assert _has_comeback({}, gap_days=7) is False


def test_achievements_unknown_user_returns_404(client) -> None:
    resp = client.get(ME_ACH_PATH, params=_params("ach-no-such-user"))
    assert resp.status_code == 404
    assert resp.json()["detail"]["code"] == "USER_404"
