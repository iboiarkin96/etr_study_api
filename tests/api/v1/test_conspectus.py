"""Tests for /api/v1/conspectuses (create/get/list/patch/delete/due/history/review)."""

from __future__ import annotations

from typing import Any

from tests.api.v1.user_test_utils import (
    TEST_INVALIDATION_REASON_UUID,
    TEST_SYSTEM_UUID,
    USER_HTTP_BASE_PATH,
    user_create_body,
)

CONS_HTTP_BASE_PATH = "/api/v1/conspectuses"


def _seed_user(client, system_user_id: str) -> str:
    response = client.post(
        USER_HTTP_BASE_PATH,
        json=user_create_body(system_user_id),
        headers={"Idempotency-Key": f"seed-{system_user_id}"},
    )
    assert response.status_code == 201, response.json()
    return response.json()["client_uuid"]


def _create_body(system_user_id: str, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "system_user_id": system_user_id,
        "system_uuid": TEST_SYSTEM_UUID,
        "title": "Note 1",
        "cue_sheet": {"terms": ["a"], "questions": ["q?"]},
        "dense_paragraph": "This is a dense paragraph.",
        "bullets": ["one", "two", "three"],
    }
    body.update(overrides)
    return body


def _create(client, system_user_id: str, idem: str, **overrides: Any) -> dict[str, Any]:
    resp = client.post(
        CONS_HTTP_BASE_PATH,
        json=_create_body(system_user_id, **overrides),
        headers={"Idempotency-Key": idem},
    )
    assert resp.status_code == 201, resp.json()
    return resp.json()


def test_create_conspectus_success(client) -> None:
    _seed_user(client, "cn-1")

    body = _create(client, "cn-1", "cn-create-1")

    assert body["title"] == "Note 1"
    assert body["dense_paragraph"] == "This is a dense paragraph."
    assert body["bullets"] == ["one", "two", "three"]
    assert body["slot"] == "A"
    assert body["schedule_revision"] == 1
    assert body["content_version"] == 1
    assert body["is_row_invalid"] == 0


def test_create_conspectus_user_not_found(client) -> None:
    resp = client.post(
        CONS_HTTP_BASE_PATH,
        json=_create_body("no-such-user"),
        headers={"Idempotency-Key": "cn-nouser-1"},
    )
    assert resp.status_code == 404
    assert resp.json()["detail"]["code"] == "USER_404"


def test_get_conspectus_owner_scoped(client) -> None:
    _seed_user(client, "cn-getter")
    created = _create(client, "cn-getter", "cn-get-seed")

    resp = client.get(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
        params={"system_user_id": "cn-getter", "system_uuid": TEST_SYSTEM_UUID},
    )

    assert resp.status_code == 200
    assert resp.json()["conspectus_uuid"] == created["conspectus_uuid"]


def test_get_conspectus_cross_tenant_is_404(client) -> None:
    _seed_user(client, "cn-owner-a")
    _seed_user(client, "cn-owner-b")
    created = _create(client, "cn-owner-a", "cn-cross-seed")

    resp = client.get(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
        params={"system_user_id": "cn-owner-b", "system_uuid": TEST_SYSTEM_UUID},
    )
    assert resp.status_code == 404
    assert resp.json()["detail"]["code"] == "CONS_404"


def test_list_conspectuses_pagination(client) -> None:
    _seed_user(client, "cn-list")
    for i in range(4):
        _create(client, "cn-list", f"cn-list-{i}", title=f"n-{i}")

    page_1 = client.get(
        CONS_HTTP_BASE_PATH,
        params={
            "system_user_id": "cn-list",
            "system_uuid": TEST_SYSTEM_UUID,
            "limit": 2,
        },
    ).json()

    assert page_1["count"] == 2
    assert page_1["has_more"] is True
    assert page_1["next_cursor"] is not None

    page_2 = client.get(
        CONS_HTTP_BASE_PATH,
        params={
            "system_user_id": "cn-list",
            "system_uuid": TEST_SYSTEM_UUID,
            "limit": 2,
            "cursor": page_1["next_cursor"],
        },
    ).json()

    assert page_2["count"] == 2
    seen = {item["conspectus_uuid"] for item in page_1["items"] + page_2["items"]}
    assert len(seen) == 4


def test_patch_conspectus_bumps_content_version(client) -> None:
    _seed_user(client, "cn-patch")
    created = _create(client, "cn-patch", "cn-patch-seed")

    resp = client.patch(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
        json={
            "system_user_id": "cn-patch",
            "system_uuid": TEST_SYSTEM_UUID,
            "title": "renamed",
        },
        headers={"Idempotency-Key": "cn-patch-1"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "renamed"
    assert body["content_version"] == 2
    assert body["schedule_revision"] == 1  # unchanged by content patch


def test_patch_conspectus_empty_body_returns_400(client) -> None:
    _seed_user(client, "cn-patch-e")
    created = _create(client, "cn-patch-e", "cn-patch-e-seed")

    resp = client.patch(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
        json={
            "system_user_id": "cn-patch-e",
            "system_uuid": TEST_SYSTEM_UUID,
        },
        headers={"Idempotency-Key": "cn-patch-e-1"},
    )

    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "CONS_102"


def test_soft_delete_conspectus(client) -> None:
    _seed_user(client, "cn-del")
    created = _create(client, "cn-del", "cn-del-seed")

    resp = client.request(
        "DELETE",
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
        json={
            "system_user_id": "cn-del",
            "system_uuid": TEST_SYSTEM_UUID,
            "invalidation_reason_uuid": TEST_INVALIDATION_REASON_UUID,
        },
        headers={"Idempotency-Key": "cn-del-1"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["is_row_invalid"] == 1
    assert body["invalidation_reason_uuid"] == TEST_INVALIDATION_REASON_UUID
    assert body["invalidated_at"] is not None


def test_list_due_conspectuses(client) -> None:
    _seed_user(client, "cn-due")
    created = _create(client, "cn-due", "cn-due-1")

    # created_at + PT1H by default → not due at now(), but due within 24h
    resp = client.get(
        f"{CONS_HTTP_BASE_PATH}/due",
        params={
            "system_user_id": "cn-due",
            "system_uuid": TEST_SYSTEM_UUID,
            "due_before": "2200-01-01T00:00:00+00:00",
        },
    )

    assert resp.status_code == 200
    uuids = [item["conspectus_uuid"] for item in resp.json()]
    assert created["conspectus_uuid"] in uuids


def test_review_conspectus_advances_slot(client) -> None:
    _seed_user(client, "cn-rev")
    created = _create(client, "cn-rev", "cn-rev-seed")

    resp = client.post(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/actions/review",
        json={
            "system_user_id": "cn-rev",
            "system_uuid": TEST_SYSTEM_UUID,
            "tag": "easy",
        },
        headers={"Idempotency-Key": "cn-rev-1"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["slot"] == "B"
    assert body["schedule_revision"] == 2


def test_review_conspectus_revision_conflict(client) -> None:
    _seed_user(client, "cn-rev-cc")
    created = _create(client, "cn-rev-cc", "cn-rev-cc-seed")

    resp = client.post(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/actions/review",
        json={
            "system_user_id": "cn-rev-cc",
            "system_uuid": TEST_SYSTEM_UUID,
            "tag": "easy",
            "expected_schedule_revision": 999,
        },
        headers={"Idempotency-Key": "cn-rev-cc-1"},
    )

    assert resp.status_code == 409
    assert resp.json()["detail"]["code"] == "CONS_409"


def test_list_conspectuses_slot_filter(client) -> None:
    _seed_user(client, "cn-slot")
    a = _create(client, "cn-slot", "cn-slot-a")
    b = _create(client, "cn-slot", "cn-slot-b")
    # Promote `b` A→B via `easy` review.
    client.post(
        f"{CONS_HTTP_BASE_PATH}/{b['conspectus_uuid']}/actions/review",
        json={"system_user_id": "cn-slot", "system_uuid": TEST_SYSTEM_UUID, "tag": "easy"},
        headers={"Idempotency-Key": "cn-slot-review-b"},
    )

    filtered_b = client.get(
        CONS_HTTP_BASE_PATH,
        params={
            "system_user_id": "cn-slot",
            "system_uuid": TEST_SYSTEM_UUID,
            "slot": "B",
        },
    ).json()
    filtered_a = client.get(
        CONS_HTTP_BASE_PATH,
        params={
            "system_user_id": "cn-slot",
            "system_uuid": TEST_SYSTEM_UUID,
            "slot": "A",
        },
    ).json()

    assert [i["conspectus_uuid"] for i in filtered_b["items"]] == [b["conspectus_uuid"]]
    assert [i["conspectus_uuid"] for i in filtered_a["items"]] == [a["conspectus_uuid"]]


def test_list_conspectuses_created_range(client) -> None:
    _seed_user(client, "cn-range")
    _create(client, "cn-range", "cn-range-1")

    far_future = "2200-01-01T00:00:00+00:00"
    far_past = "2000-01-01T00:00:00+00:00"

    # created_after in the far future → nothing.
    empty = client.get(
        CONS_HTTP_BASE_PATH,
        params={
            "system_user_id": "cn-range",
            "system_uuid": TEST_SYSTEM_UUID,
            "created_after": far_future,
        },
    ).json()
    assert empty["count"] == 0

    # created_before in the far past → nothing.
    empty2 = client.get(
        CONS_HTTP_BASE_PATH,
        params={
            "system_user_id": "cn-range",
            "system_uuid": TEST_SYSTEM_UUID,
            "created_before": far_past,
        },
    ).json()
    assert empty2["count"] == 0


def test_list_conspectuses_inverted_range_returns_422(client) -> None:
    _seed_user(client, "cn-inv")
    resp = client.get(
        CONS_HTTP_BASE_PATH,
        params={
            "system_user_id": "cn-inv",
            "system_uuid": TEST_SYSTEM_UUID,
            "created_after": "2200-01-01T00:00:00+00:00",
            "created_before": "2000-01-01T00:00:00+00:00",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "COMMON_000"


def test_list_conspectuses_bad_cursor_returns_422(client) -> None:
    _seed_user(client, "cn-bad-cursor")
    resp = client.get(
        CONS_HTTP_BASE_PATH,
        params={
            "system_user_id": "cn-bad-cursor",
            "system_uuid": TEST_SYSTEM_UUID,
            "cursor": "not-a-real-cursor!!",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "COMMON_000"


def test_list_conspectuses_include_invalid(client) -> None:
    _seed_user(client, "cn-inv-flag")
    created = _create(client, "cn-inv-flag", "cn-inv-flag-seed")
    client.request(
        "DELETE",
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
        json={
            "system_user_id": "cn-inv-flag",
            "system_uuid": TEST_SYSTEM_UUID,
            "invalidation_reason_uuid": TEST_INVALIDATION_REASON_UUID,
        },
        headers={"Idempotency-Key": "cn-inv-flag-del"},
    )

    hidden = client.get(
        CONS_HTTP_BASE_PATH,
        params={"system_user_id": "cn-inv-flag", "system_uuid": TEST_SYSTEM_UUID},
    ).json()
    included = client.get(
        CONS_HTTP_BASE_PATH,
        params={
            "system_user_id": "cn-inv-flag",
            "system_uuid": TEST_SYSTEM_UUID,
            "include_invalid": "true",
        },
    ).json()

    assert hidden["count"] == 0
    assert included["count"] == 1
    assert included["items"][0]["is_row_invalid"] == 1


def test_delete_conspectus_unlinks_learning_errors(client) -> None:
    _seed_user(client, "cn-del-unlink")
    created = _create(client, "cn-del-unlink", "cn-del-unlink-seed")

    client.post(
        "/api/v1/errors",
        json={
            "system_user_id": "cn-del-unlink",
            "system_uuid": TEST_SYSTEM_UUID,
            "message": "linked to soon-deleted",
            "conspectus_uuid": created["conspectus_uuid"],
        },
        headers={"Idempotency-Key": "cn-del-unlink-err"},
    )
    client.request(
        "DELETE",
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
        json={
            "system_user_id": "cn-del-unlink",
            "system_uuid": TEST_SYSTEM_UUID,
            "invalidation_reason_uuid": TEST_INVALIDATION_REASON_UUID,
        },
        headers={"Idempotency-Key": "cn-del-unlink-del"},
    )

    listed = client.get(
        "/api/v1/errors",
        params={"system_user_id": "cn-del-unlink", "system_uuid": TEST_SYSTEM_UUID},
    ).json()

    assert len(listed) == 1
    assert listed[0]["conspectus_uuid"] is None


def test_patch_conspectus_bullets_and_dense_paragraph(client) -> None:
    _seed_user(client, "cn-patch-body")
    created = _create(client, "cn-patch-body", "cn-patch-body-seed")

    resp = client.patch(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
        json={
            "system_user_id": "cn-patch-body",
            "system_uuid": TEST_SYSTEM_UUID,
            "bullets": ["only", "these", "remain"],
            "dense_paragraph": "brand new body",
            "cue_sheet": {"terms": ["x", "y"]},
        },
        headers={"Idempotency-Key": "cn-patch-body-1"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["bullets"] == ["only", "these", "remain"]
    assert body["dense_paragraph"] == "brand new body"
    assert body["cue_sheet"] == {"terms": ["x", "y"]}
    assert body["content_version"] == 2


def test_create_conspectus_missing_field_returns_cons_code(client) -> None:
    """POST /conspectuses missing bullets → 422 with the specific CONS_010 code."""
    _seed_user(client, "cn-code-1")
    body = _create_body("cn-code-1")
    del body["bullets"]

    resp = client.post(
        CONS_HTTP_BASE_PATH,
        json=body,
        headers={"Idempotency-Key": "cn-code-1"},
    )

    assert resp.status_code == 422
    body = resp.json()
    assert body["error_type"] == "validation_error"
    codes = {err["code"] for err in body["errors"]}
    assert "CONS_010" in codes


def test_review_conspectus_bad_tag_returns_cons_code(client) -> None:
    """POST review with an unknown tag → 422 CONS_071."""
    _seed_user(client, "cn-code-2")
    created = _create(client, "cn-code-2", "cn-code-2-seed")

    resp = client.post(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/actions/review",
        json={
            "system_user_id": "cn-code-2",
            "system_uuid": TEST_SYSTEM_UUID,
            "tag": "maybe",
        },
        headers={"Idempotency-Key": "cn-code-2"},
    )

    assert resp.status_code == 422
    codes = {err["code"] for err in resp.json()["errors"]}
    assert "CONS_071" in codes


def test_delete_conspectus_missing_reason_returns_cons_code(client) -> None:
    """DELETE without invalidation_reason_uuid → 422 CONS_050."""
    _seed_user(client, "cn-code-3")
    created = _create(client, "cn-code-3", "cn-code-3-seed")

    resp = client.request(
        "DELETE",
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
        json={
            "system_user_id": "cn-code-3",
            "system_uuid": TEST_SYSTEM_UUID,
        },
        headers={"Idempotency-Key": "cn-code-3"},
    )

    assert resp.status_code == 422
    codes = {err["code"] for err in resp.json()["errors"]}
    assert "CONS_050" in codes


def test_create_conspectus_rejects_empty_bullet(client) -> None:
    _seed_user(client, "cn-bul-empty")
    resp = client.post(
        CONS_HTTP_BASE_PATH,
        json=_create_body("cn-bul-empty", bullets=["", "b"]),
        headers={"Idempotency-Key": "cn-bul-empty-1"},
    )
    assert resp.status_code == 422


def test_create_conspectus_rejects_over_long_bullet(client) -> None:
    _seed_user(client, "cn-bul-long")
    resp = client.post(
        CONS_HTTP_BASE_PATH,
        json=_create_body("cn-bul-long", bullets=["x" * 600]),
        headers={"Idempotency-Key": "cn-bul-long-1"},
    )
    assert resp.status_code == 422


def test_patch_conspectus_rejects_empty_bullet(client) -> None:
    _seed_user(client, "cn-patch-bul")
    created = _create(client, "cn-patch-bul", "cn-patch-bul-seed")
    resp = client.patch(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
        json={
            "system_user_id": "cn-patch-bul",
            "system_uuid": TEST_SYSTEM_UUID,
            "bullets": [""],
        },
        headers={"Idempotency-Key": "cn-patch-bul-1"},
    )
    assert resp.status_code == 422


def test_patch_conspectus_rejects_explicit_null_replacement(client) -> None:
    """Non-nullable ETR fields must not accept ``null`` — omit the field to leave unchanged."""
    _seed_user(client, "cn-patch-null")
    created = _create(client, "cn-patch-null", "cn-patch-null-seed")

    for field in ("cue_sheet", "dense_paragraph", "bullets"):
        resp = client.patch(
            f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
            json={
                "system_user_id": "cn-patch-null",
                "system_uuid": TEST_SYSTEM_UUID,
                field: None,
            },
            headers={"Idempotency-Key": f"cn-patch-null-{field}"},
        )
        assert resp.status_code == 422, f"{field} null must be rejected: {resp.json()}"


def test_patch_conspectus_null_title_allowed(client) -> None:
    """`title` is nullable in the DB; PATCH null must be accepted (clears the title)."""
    _seed_user(client, "cn-patch-nulltitle")
    created = _create(client, "cn-patch-nulltitle", "cn-patch-nulltitle-seed")

    resp = client.patch(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
        json={
            "system_user_id": "cn-patch-nulltitle",
            "system_uuid": TEST_SYSTEM_UUID,
            "title": None,
        },
        headers={"Idempotency-Key": "cn-patch-nulltitle-1"},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] is None


def test_history_returns_created_and_review_events(client) -> None:
    _seed_user(client, "cn-hist")
    created = _create(client, "cn-hist", "cn-hist-seed")
    client.post(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/actions/review",
        json={
            "system_user_id": "cn-hist",
            "system_uuid": TEST_SYSTEM_UUID,
            "tag": "easy",
        },
        headers={"Idempotency-Key": "cn-hist-review-1"},
    )
    client.patch(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
        json={
            "system_user_id": "cn-hist",
            "system_uuid": TEST_SYSTEM_UUID,
            "title": "renamed",
        },
        headers={"Idempotency-Key": "cn-hist-patch-1"},
    )

    resp = client.get(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/history",
        params={"system_user_id": "cn-hist", "system_uuid": TEST_SYSTEM_UUID},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["conspectus_uuid"] == created["conspectus_uuid"]
    event_types = [item["event_type"] for item in body["items"]]
    assert "review" in event_types
    assert "content_patch" in event_types


def test_history_filter_by_event_type(client) -> None:
    _seed_user(client, "cn-hist-f")
    created = _create(client, "cn-hist-f", "cn-hist-f-seed")
    client.post(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/actions/review",
        json={
            "system_user_id": "cn-hist-f",
            "system_uuid": TEST_SYSTEM_UUID,
            "tag": "easy",
        },
        headers={"Idempotency-Key": "cn-hist-f-rev"},
    )
    client.patch(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
        json={
            "system_user_id": "cn-hist-f",
            "system_uuid": TEST_SYSTEM_UUID,
            "title": "renamed",
        },
        headers={"Idempotency-Key": "cn-hist-f-patch"},
    )

    only_reviews = client.get(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/history",
        params={
            "system_user_id": "cn-hist-f",
            "system_uuid": TEST_SYSTEM_UUID,
            "event_type": "review",
        },
    ).json()
    only_patches = client.get(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/history",
        params={
            "system_user_id": "cn-hist-f",
            "system_uuid": TEST_SYSTEM_UUID,
            "event_type": "content_patch",
        },
    ).json()

    assert {item["event_type"] for item in only_reviews["items"]} == {"review"}
    assert {item["event_type"] for item in only_patches["items"]} == {"content_patch"}


def test_history_since_filters_older_rows(client) -> None:
    _seed_user(client, "cn-hist-since")
    created = _create(client, "cn-hist-since", "cn-hist-since-seed")

    all_rows = client.get(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/history",
        params={"system_user_id": "cn-hist-since", "system_uuid": TEST_SYSTEM_UUID},
    ).json()
    assert all_rows["count"] >= 0  # sanity

    # `since` in the far future → empty history.
    filtered = client.get(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/history",
        params={
            "system_user_id": "cn-hist-since",
            "system_uuid": TEST_SYSTEM_UUID,
            "since": "2200-01-01T00:00:00+00:00",
        },
    ).json()
    assert filtered["count"] == 0


def test_history_cursor_pagination(client) -> None:
    _seed_user(client, "cn-hist-pag")
    created = _create(client, "cn-hist-pag", "cn-hist-pag-seed")
    for i in range(3):
        client.patch(
            f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
            json={
                "system_user_id": "cn-hist-pag",
                "system_uuid": TEST_SYSTEM_UUID,
                "title": f"rename-{i}",
            },
            headers={"Idempotency-Key": f"cn-hist-pag-{i}"},
        )

    page_1 = client.get(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/history",
        params={
            "system_user_id": "cn-hist-pag",
            "system_uuid": TEST_SYSTEM_UUID,
            "limit": 2,
        },
    ).json()
    assert page_1["count"] == 2
    assert page_1["has_more"] is True
    assert page_1["next_cursor"] is not None

    page_2 = client.get(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/history",
        params={
            "system_user_id": "cn-hist-pag",
            "system_uuid": TEST_SYSTEM_UUID,
            "limit": 2,
            "cursor": page_1["next_cursor"],
        },
    ).json()
    seen = {item["event_id"] for item in page_1["items"] + page_2["items"]}
    assert len(seen) == page_1["count"] + page_2["count"]


def test_history_cursor_paginates_mixed_event_kinds(client) -> None:
    """Pagination must not lose or duplicate rows when reviews and content_patches interleave."""
    _seed_user(client, "cn-hist-mixed")
    created = _create(client, "cn-hist-mixed", "cn-hist-mixed-seed")

    # Interleave one review and one patch three times.
    for i in range(3):
        client.post(
            f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/actions/review",
            json={
                "system_user_id": "cn-hist-mixed",
                "system_uuid": TEST_SYSTEM_UUID,
                "tag": "hard",  # `hard` keeps the note in slot A so we can keep reviewing.
            },
            headers={"Idempotency-Key": f"cn-hist-mixed-rev-{i}"},
        )
        client.patch(
            f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
            json={
                "system_user_id": "cn-hist-mixed",
                "system_uuid": TEST_SYSTEM_UUID,
                "title": f"title-{i}",
            },
            headers={"Idempotency-Key": f"cn-hist-mixed-patch-{i}"},
        )

    seen_ids: list[str] = []
    cursor: str | None = None
    while True:
        params = {
            "system_user_id": "cn-hist-mixed",
            "system_uuid": TEST_SYSTEM_UUID,
            "limit": 2,
        }
        if cursor is not None:
            params["cursor"] = cursor
        body = client.get(
            f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/history",
            params=params,
        ).json()
        seen_ids.extend(item["event_id"] for item in body["items"])
        if not body["has_more"]:
            break
        cursor = body["next_cursor"]
        assert cursor is not None

    # 3 review logs + 3 content-patch events = 6 rows, no duplicates.
    assert len(seen_ids) == 6
    assert len(set(seen_ids)) == 6
    # Kinds interleave; verify both prefixes appear.
    assert any(eid.startswith("r") for eid in seen_ids)
    assert any(eid.startswith("e") for eid in seen_ids)


def test_history_bad_cursor_returns_422(client) -> None:
    _seed_user(client, "cn-hist-bad")
    created = _create(client, "cn-hist-bad", "cn-hist-bad-seed")

    resp = client.get(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/history",
        params={
            "system_user_id": "cn-hist-bad",
            "system_uuid": TEST_SYSTEM_UUID,
            "cursor": "not-a-real-cursor!!",
        },
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["code"] == "COMMON_000"


def test_create_conspectus_idempotent_replay(client) -> None:
    _seed_user(client, "cn-idem-c")
    body = _create_body("cn-idem-c")
    first = client.post(CONS_HTTP_BASE_PATH, json=body, headers={"Idempotency-Key": "cn-idem-c-1"})
    second = client.post(CONS_HTTP_BASE_PATH, json=body, headers={"Idempotency-Key": "cn-idem-c-1"})

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["conspectus_uuid"] == second.json()["conspectus_uuid"]


def test_create_conspectus_idempotency_conflict(client) -> None:
    _seed_user(client, "cn-idem-cc")
    body_a = _create_body("cn-idem-cc", title="A")
    body_b = _create_body("cn-idem-cc", title="B")
    client.post(CONS_HTTP_BASE_PATH, json=body_a, headers={"Idempotency-Key": "cn-idem-cc-1"})
    dup = client.post(CONS_HTTP_BASE_PATH, json=body_b, headers={"Idempotency-Key": "cn-idem-cc-1"})
    assert dup.status_code == 409
    assert dup.json()["detail"]["code"] == "COMMON_409"


def test_patch_conspectus_idempotent_replay(client) -> None:
    _seed_user(client, "cn-idem-p")
    created = _create(client, "cn-idem-p", "cn-idem-p-seed")
    body = {
        "system_user_id": "cn-idem-p",
        "system_uuid": TEST_SYSTEM_UUID,
        "title": "patched",
    }
    first = client.patch(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
        json=body,
        headers={"Idempotency-Key": "cn-idem-p-1"},
    )
    second = client.patch(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
        json=body,
        headers={"Idempotency-Key": "cn-idem-p-1"},
    )
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["content_version"] == second.json()["content_version"]


def test_delete_conspectus_idempotent_replay(client) -> None:
    _seed_user(client, "cn-idem-d")
    created = _create(client, "cn-idem-d", "cn-idem-d-seed")
    body = {
        "system_user_id": "cn-idem-d",
        "system_uuid": TEST_SYSTEM_UUID,
        "invalidation_reason_uuid": TEST_INVALIDATION_REASON_UUID,
    }
    first = client.request(
        "DELETE",
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
        json=body,
        headers={"Idempotency-Key": "cn-idem-d-1"},
    )
    second = client.request(
        "DELETE",
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}",
        json=body,
        headers={"Idempotency-Key": "cn-idem-d-1"},
    )
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["invalidated_at"] == second.json()["invalidated_at"]


def test_review_conspectus_idempotent_replay(client) -> None:
    _seed_user(client, "cn-idem-r")
    created = _create(client, "cn-idem-r", "cn-idem-r-seed")
    body = {
        "system_user_id": "cn-idem-r",
        "system_uuid": TEST_SYSTEM_UUID,
        "tag": "easy",
    }
    first = client.post(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/actions/review",
        json=body,
        headers={"Idempotency-Key": "cn-idem-r-1"},
    )
    second = client.post(
        f"{CONS_HTTP_BASE_PATH}/{created['conspectus_uuid']}/actions/review",
        json=body,
        headers={"Idempotency-Key": "cn-idem-r-1"},
    )
    assert first.status_code == 200
    assert second.status_code == 200
    # Second call must NOT advance the schedule again.
    assert first.json()["schedule_revision"] == second.json()["schedule_revision"]


def test_list_due_slot_filter(client) -> None:
    _seed_user(client, "cn-due-slot")
    a = _create(client, "cn-due-slot", "cn-due-slot-a")
    b = _create(client, "cn-due-slot", "cn-due-slot-b")
    client.post(
        f"{CONS_HTTP_BASE_PATH}/{b['conspectus_uuid']}/actions/review",
        json={"system_user_id": "cn-due-slot", "system_uuid": TEST_SYSTEM_UUID, "tag": "easy"},
        headers={"Idempotency-Key": "cn-due-slot-rev"},
    )

    only_a = client.get(
        f"{CONS_HTTP_BASE_PATH}/due",
        params={
            "system_user_id": "cn-due-slot",
            "system_uuid": TEST_SYSTEM_UUID,
            "due_before": "2200-01-01T00:00:00+00:00",
            "slot": "A",
        },
    ).json()

    assert [i["conspectus_uuid"] for i in only_a] == [a["conspectus_uuid"]]
