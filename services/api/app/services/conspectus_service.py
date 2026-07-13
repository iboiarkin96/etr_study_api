"""Business logic for the Conspectus / Schedule / Review / History workflows."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from fastapi import HTTPException

from app.domain.scheduling import (
    ALGORITHM_VERSION,
    SCHEDULE_POLICY_ID,
    SCHEDULE_POLICY_VERSION,
    apply_review,
    initial_state,
)
from app.errors.conspectus import CONS_102, CONS_404, CONS_409
from app.models.core.conspectus import (
    Conspectus,
    ConspectusEvent,
    ConspectusReviewLog,
    ConspectusSchedule,
)
from app.repositories.conspectus_repository import (
    ConspectusRepository,
    ConspectusView,
    HistoryRow,
)
from app.schemas.conspectus import (
    ConspectusCreateRequest,
    ConspectusDeleteRequest,
    ConspectusPatchRequest,
    ConspectusReviewRequest,
)

logger = logging.getLogger(__name__)


class ConspectusService:
    """Coordinates the four Conspectus tables + the review state machine."""

    def __init__(self, repository: ConspectusRepository) -> None:
        """Bind to a repository.

        Args:
            repository: Data-access instance for this request.
        """
        self.repository = repository

    # ---------- create / get / list ----------

    def create(
        self,
        *,
        payload: ConspectusCreateRequest,
        owner_client_uuid: str,
    ) -> ConspectusView:
        """Insert a new conspectus with its initial schedule row and CREATED event."""
        now = datetime.now(UTC)
        state = initial_state()
        conspectus_uuid = str(uuid4())
        conspectus = Conspectus(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
            title=payload.title,
            cue_sheet=payload.cue_sheet,
            cue_sheet_schema_version=1,
            dense_paragraph=payload.dense_paragraph,
            bullets=payload.bullets,
            content_version=1,
            created_at=now,
            updated_at=now,
            is_row_invalid=0,
        )
        schedule = ConspectusSchedule(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
            slot=state.slot,
            slot_d_ladder_index=state.slot_d_ladder_index,
            next_review_at=now + state.delay,
            schedule_revision=1,
            schedule_policy_id=SCHEDULE_POLICY_ID,
            schedule_policy_version=SCHEDULE_POLICY_VERSION,
            algorithm_version=ALGORITHM_VERSION,
            schedule_updated_at=now,
            is_row_invalid=0,
        )
        event = ConspectusEvent(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
            event_type="CREATED",
            payload=None,
            content_version_after=1,
            actor_system_user_id=payload.system_user_id,
            actor_system_uuid=str(payload.system_uuid),
            created_at=now,
        )
        self.repository.save_new(conspectus=conspectus, schedule=schedule, create_event=event)
        logger.info(
            "conspectus_created conspectus_uuid=%s owner=%s",
            conspectus_uuid,
            owner_client_uuid,
        )
        view = self.repository.get_view(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
        )
        assert view is not None  # just inserted in this transaction
        return view

    def get_or_404(
        self,
        *,
        conspectus_uuid: str,
        owner_client_uuid: str,
    ) -> ConspectusView:
        """Fetch one conspectus or raise :data:`CONS_404`."""
        view = self.repository.get_view(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
        )
        if view is None:
            logger.info(
                "conspectus_not_found conspectus_uuid=%s owner=%s",
                conspectus_uuid,
                owner_client_uuid,
            )
            raise HTTPException(status_code=404, detail=CONS_404.as_detail("business"))
        return view

    def list_page(
        self,
        *,
        owner_client_uuid: str,
        limit: int,
        cursor: tuple[datetime, str] | None,
        slot: str | None,
        created_after: datetime | None,
        created_before: datetime | None,
        include_invalid: bool,
    ) -> tuple[list[ConspectusView], bool, tuple[datetime, str] | None]:
        """Paginate the owner's notes.

        Args:
            owner_client_uuid: Owner scope.
            limit: Page size after truncation.
            cursor: Keyset cursor from a prior page.
            slot: Optional slot filter.
            created_after: Optional inclusive lower bound on ``created_at``.
            created_before: Optional exclusive upper bound on ``created_at``.
            include_invalid: Include soft-deleted rows when ``True``.

        Returns:
            Tuple ``(page_items, has_more, next_cursor)``. ``next_cursor`` is ``None``
            when there is no more data.
        """
        rows = self.repository.list_views(
            owner_client_uuid=owner_client_uuid,
            limit=limit,
            cursor=cursor,
            slot=slot,
            created_after=created_after,
            created_before=created_before,
            include_invalid=include_invalid,
        )
        has_more = len(rows) > limit
        page = rows[:limit]
        next_cursor: tuple[datetime, str] | None = None
        if has_more and page:
            tail = page[-1]
            next_cursor = (tail.created_at, tail.conspectus_uuid)
        return page, has_more, next_cursor

    def list_due(
        self,
        *,
        owner_client_uuid: str,
        due_before: datetime,
        slot: str | None,
    ) -> list[ConspectusView]:
        """Return the top-100 due items (no cursor by design)."""
        return self.repository.list_due(
            owner_client_uuid=owner_client_uuid,
            due_before=due_before,
            slot=slot,
        )

    # ---------- patch / delete ----------

    def patch(
        self,
        *,
        conspectus_uuid: str,
        owner_client_uuid: str,
        payload: ConspectusPatchRequest,
    ) -> ConspectusView:
        """Update only the ETR content fields present in ``payload``."""
        changed_fields: list[str] = []
        # Fresh ORM handle so ``add`` marks the row dirty.
        view = self.get_or_404(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
        )
        # Reload from ORM to mutate.
        row_c = self.repository.session.get(Conspectus, view.conspectus_uuid)
        assert row_c is not None
        payload_dict = payload.model_dump(exclude_unset=True)
        for field in ("title", "cue_sheet", "dense_paragraph", "bullets"):
            if field in payload_dict:
                setattr(row_c, field, payload_dict[field])
                changed_fields.append(field)
        if not changed_fields:
            logger.info(
                "conspectus_patch_empty_body conspectus_uuid=%s owner=%s",
                conspectus_uuid,
                owner_client_uuid,
            )
            raise HTTPException(status_code=400, detail=CONS_102.as_detail("business"))

        now = datetime.now(UTC)
        row_c.content_version += 1
        row_c.updated_at = now
        event = ConspectusEvent(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
            event_type="CONTENT_PATCHED",
            payload={"changed_fields": changed_fields},
            content_version_after=row_c.content_version,
            actor_system_user_id=payload.system_user_id,
            actor_system_uuid=str(payload.system_uuid),
            created_at=now,
        )
        self.repository.apply_content_patch(conspectus=row_c, patch_event=event)
        logger.info(
            "conspectus_patched conspectus_uuid=%s owner=%s fields=%s",
            conspectus_uuid,
            owner_client_uuid,
            changed_fields,
        )
        fresh = self.repository.get_view(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
        )
        assert fresh is not None
        return fresh

    def soft_delete(
        self,
        *,
        conspectus_uuid: str,
        owner_client_uuid: str,
        payload: ConspectusDeleteRequest,
    ) -> ConspectusView:
        """Mark the conspectus + schedule invalid and unlink learner errors."""
        # 404 if the row is missing or belongs to another owner.
        _ = self.get_or_404(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
        )
        now = datetime.now(UTC)
        unlinked = self.repository.soft_delete(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
            invalidation_reason_uuid=str(payload.invalidation_reason_uuid),
            now=now,
        )
        logger.info(
            "conspectus_deleted conspectus_uuid=%s owner=%s unlinked_error_count=%s",
            conspectus_uuid,
            owner_client_uuid,
            unlinked,
        )
        view = self.repository.get_view(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
        )
        assert view is not None
        return view

    # ---------- review ----------

    def review(
        self,
        *,
        conspectus_uuid: str,
        owner_client_uuid: str,
        payload: ConspectusReviewRequest,
    ) -> ConspectusView:
        """Apply the state machine transition and append an audit row.

        Raises 404 when the note is missing / not owned; 409 when the caller sent an
        ``expected_schedule_revision`` that no longer matches.
        """
        view = self.get_or_404(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
        )
        current_revision = view.schedule_revision
        if (
            payload.expected_schedule_revision is not None
            and payload.expected_schedule_revision != current_revision
        ):
            logger.info(
                "conspectus_review_revision_conflict conspectus_uuid=%s expected=%s actual=%s",
                conspectus_uuid,
                payload.expected_schedule_revision,
                current_revision,
            )
            raise HTTPException(status_code=409, detail=CONS_409.as_detail("business"))

        current_slot: Literal["A", "B", "C", "D"] = _coerce_slot(view.slot)
        transition = apply_review(current_slot, view.slot_d_ladder_index, payload.tag)
        now = datetime.now(UTC)
        new_next_review_at = now + transition.delay
        new_revision = current_revision + 1

        review_log = ConspectusReviewLog(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
            tag=payload.tag,
            slot_before=current_slot,
            slot_after=transition.slot,
            slot_d_ladder_index_before=view.slot_d_ladder_index,
            slot_d_ladder_index_after=transition.slot_d_ladder_index,
            schedule_revision_before=current_revision,
            schedule_revision_after=new_revision,
            next_review_at_before=view.next_review_at,
            next_review_at_after=new_next_review_at,
            algorithm_version=ALGORITHM_VERSION,
            schedule_policy_id=SCHEDULE_POLICY_ID,
            schedule_policy_version=SCHEDULE_POLICY_VERSION,
            actor_system_user_id=payload.system_user_id,
            actor_system_uuid=str(payload.system_uuid),
            reviewed_at=now,
            created_at=now,
        )
        won = self.repository.commit_review(
            conspectus_uuid=conspectus_uuid,
            expected_revision=current_revision,
            new_values={
                "slot": transition.slot,
                "slot_d_ladder_index": transition.slot_d_ladder_index,
                "next_review_at": new_next_review_at,
                "schedule_revision": new_revision,
                "schedule_updated_at": now,
            },
            review_log=review_log,
        )
        if not won:
            logger.info(
                "conspectus_review_lost_race conspectus_uuid=%s expected=%s",
                conspectus_uuid,
                current_revision,
            )
            raise HTTPException(status_code=409, detail=CONS_409.as_detail("business"))

        logger.info(
            "conspectus_reviewed conspectus_uuid=%s tag=%s slot_from=%s slot_to=%s",
            conspectus_uuid,
            payload.tag,
            current_slot,
            transition.slot,
        )
        fresh = self.repository.get_view(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
        )
        assert fresh is not None
        return fresh

    # ---------- history ----------

    def history(
        self,
        *,
        conspectus_uuid: str,
        owner_client_uuid: str,
        event_type: Literal["review", "content_patch"] | None,
        since: datetime | None,
        limit: int,
        cursor: tuple[datetime, str] | None,
    ) -> tuple[list[HistoryRow], bool, tuple[datetime, str] | None]:
        """Fetch history rows for the conspectus (404 when missing / not owned)."""
        _ = self.get_or_404(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
        )
        rows = self.repository.list_history(
            conspectus_uuid=conspectus_uuid,
            limit=limit,
            event_type=event_type,
            since=since,
            cursor=cursor,
        )
        has_more = len(rows) > limit
        page = rows[:limit]
        next_cursor: tuple[datetime, str] | None = None
        if has_more and page:
            tail = page[-1]
            next_cursor = (tail.created_at, tail.event_id)
        return page, has_more, next_cursor


def _coerce_slot(value: str) -> Literal["A", "B", "C", "D"]:
    """Narrow the raw string slot to the ``Literal`` accepted by the domain module."""
    if value in ("A", "B", "C", "D"):
        return value  # type: ignore[return-value]
    raise ValueError(f"Unexpected slot value stored in DB: {value!r}")
