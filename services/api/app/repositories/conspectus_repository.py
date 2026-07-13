"""Data access layer for the Conspectus / Schedule / History tables."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import and_, or_, select, update
from sqlalchemy.orm import Session

from app.models.core.conspectus import (
    Conspectus,
    ConspectusEvent,
    ConspectusReviewLog,
    ConspectusSchedule,
)
from app.models.core.learning_error import LearningError


@dataclass(frozen=True, slots=True)
class ConspectusView:
    """Flattened row of ``conspectuses`` joined with ``conspectus_schedules``.

    Fields are named to match :class:`~app.schemas.conspectus.ConspectusResponse` so
    the router can call ``model_validate`` without further transformation.
    """

    conspectus_uuid: str
    title: str | None
    cue_sheet: dict[str, Any]
    cue_sheet_schema_version: int
    dense_paragraph: str
    bullets: list[str]
    content_version: int
    slot: str
    slot_d_ladder_index: int
    next_review_at: datetime
    schedule_revision: int
    schedule_policy_id: str
    schedule_policy_version: str
    algorithm_version: str
    schedule_updated_at: datetime
    is_row_invalid: int
    invalidation_reason_uuid: str | None
    invalidated_at: datetime | None
    created_at: datetime
    updated_at: datetime


HistoryEventKind = Literal["review", "content_patch"]


@dataclass(frozen=True, slots=True)
class HistoryRow:
    """Union row of ``conspectus_review_logs`` + ``conspectus_events`` for history rendering."""

    event_id: str
    event_type: HistoryEventKind
    created_at: datetime
    actor_system_user_id: str
    actor_system_uuid: str
    # review-only
    tag: str | None
    slot_before: str | None
    slot_after: str | None
    slot_d_ladder_index_before: int | None
    slot_d_ladder_index_after: int | None
    schedule_revision_after: int | None
    next_review_at_after: datetime | None
    # content-patch only
    changed_fields: list[str] | None
    content_version_after: int | None


def _build_view(row_c: Conspectus, row_s: ConspectusSchedule) -> ConspectusView:
    """Compose a :class:`ConspectusView` from parent + schedule ORM rows."""
    return ConspectusView(
        conspectus_uuid=row_c.conspectus_uuid,
        title=row_c.title,
        cue_sheet=row_c.cue_sheet,
        cue_sheet_schema_version=row_c.cue_sheet_schema_version,
        dense_paragraph=row_c.dense_paragraph,
        bullets=row_c.bullets,
        content_version=row_c.content_version,
        slot=row_s.slot,
        slot_d_ladder_index=row_s.slot_d_ladder_index,
        next_review_at=row_s.next_review_at,
        schedule_revision=row_s.schedule_revision,
        schedule_policy_id=row_s.schedule_policy_id,
        schedule_policy_version=row_s.schedule_policy_version,
        algorithm_version=row_s.algorithm_version,
        schedule_updated_at=row_s.schedule_updated_at,
        is_row_invalid=row_c.is_row_invalid,
        invalidation_reason_uuid=row_c.invalidation_reason_uuid,
        invalidated_at=row_c.invalidated_at,
        created_at=row_c.created_at,
        updated_at=row_c.updated_at,
    )


class ConspectusRepository:
    """Read + write helpers for the four Conspectus tables."""

    def __init__(self, session: Session) -> None:
        """Bind to a SQLAlchemy session.

        Args:
            session: Active DB session owned by the caller.
        """
        self.session = session

    # ---------- reads ----------

    def get_view(
        self,
        *,
        conspectus_uuid: str,
        owner_client_uuid: str,
    ) -> ConspectusView | None:
        """Load one conspectus + schedule row for the owner, or ``None``.

        Args:
            conspectus_uuid: Path parameter.
            owner_client_uuid: Owner scope; cross-tenant hits collapse to ``None``.
        """
        stmt = (
            select(Conspectus, ConspectusSchedule)
            .join(
                ConspectusSchedule,
                ConspectusSchedule.conspectus_uuid == Conspectus.conspectus_uuid,
            )
            .where(
                Conspectus.conspectus_uuid == conspectus_uuid,
                Conspectus.owner_client_uuid == owner_client_uuid,
            )
        )
        result = self.session.execute(stmt).one_or_none()
        if result is None:
            return None
        return _build_view(result[0], result[1])

    def list_views(
        self,
        *,
        owner_client_uuid: str,
        limit: int,
        cursor: tuple[datetime, str] | None,
        slot: str | None,
        created_after: datetime | None,
        created_before: datetime | None,
        include_invalid: bool,
    ) -> list[ConspectusView]:
        """Paginate the owner's notes (newest first), returning ``limit + 1`` rows.

        The caller inspects the extra row to compute ``has_more`` and to build the next
        cursor. Sort order matches the spec: ``created_at DESC, conspectus_uuid DESC``.

        Args:
            owner_client_uuid: Owner scope.
            limit: Requested page size; caller adds 1 for the has-more probe.
            cursor: ``(created_at, uuid)`` keyset from a prior next_cursor.
            slot: Optional filter on ``conspectus_schedules.slot``.
            created_after: Optional inclusive lower bound on ``created_at``.
            created_before: Optional exclusive upper bound on ``created_at``.
            include_invalid: Include soft-deleted rows when ``True``.
        """
        conditions = [Conspectus.owner_client_uuid == owner_client_uuid]
        if not include_invalid:
            conditions.append(Conspectus.is_row_invalid == 0)
        if slot is not None:
            conditions.append(ConspectusSchedule.slot == slot)
        if created_after is not None:
            conditions.append(Conspectus.created_at >= created_after)
        if created_before is not None:
            conditions.append(Conspectus.created_at < created_before)
        if cursor is not None:
            cursor_at, cursor_uuid = cursor
            # Keyset: (created_at, uuid) < (cursor_at, cursor_uuid) with DESC ordering.
            conditions.append(
                or_(
                    Conspectus.created_at < cursor_at,
                    and_(
                        Conspectus.created_at == cursor_at,
                        Conspectus.conspectus_uuid < cursor_uuid,
                    ),
                )
            )

        stmt = (
            select(Conspectus, ConspectusSchedule)
            .join(
                ConspectusSchedule,
                ConspectusSchedule.conspectus_uuid == Conspectus.conspectus_uuid,
            )
            .where(*conditions)
            .order_by(Conspectus.created_at.desc(), Conspectus.conspectus_uuid.desc())
            .limit(limit + 1)
        )
        return [_build_view(row[0], row[1]) for row in self.session.execute(stmt).all()]

    def list_due(
        self,
        *,
        owner_client_uuid: str,
        due_before: datetime,
        slot: str | None,
    ) -> list[ConspectusView]:
        """Return up to 100 non-invalid schedules whose ``next_review_at <= due_before``.

        Args:
            owner_client_uuid: Owner scope.
            due_before: Upper bound (inclusive).
            slot: Optional slot filter.
        """
        conditions = [
            Conspectus.owner_client_uuid == owner_client_uuid,
            Conspectus.is_row_invalid == 0,
            ConspectusSchedule.next_review_at <= due_before,
        ]
        if slot is not None:
            conditions.append(ConspectusSchedule.slot == slot)

        stmt = (
            select(Conspectus, ConspectusSchedule)
            .join(
                ConspectusSchedule,
                ConspectusSchedule.conspectus_uuid == Conspectus.conspectus_uuid,
            )
            .where(*conditions)
            .order_by(
                ConspectusSchedule.next_review_at.asc(),
                Conspectus.created_at.asc(),
                Conspectus.conspectus_uuid.asc(),
            )
            .limit(100)
        )
        return [_build_view(row[0], row[1]) for row in self.session.execute(stmt).all()]

    # ---------- writes ----------

    def save_new(
        self,
        *,
        conspectus: Conspectus,
        schedule: ConspectusSchedule,
        create_event: ConspectusEvent,
    ) -> None:
        """Insert the parent + schedule + CREATED event atomically."""
        self.session.add(conspectus)
        self.session.add(schedule)
        self.session.add(create_event)
        self.session.commit()

    def apply_content_patch(
        self,
        *,
        conspectus: Conspectus,
        patch_event: ConspectusEvent,
    ) -> None:
        """Persist a PATCH: bumped ``content_version`` + audit event."""
        self.session.add(conspectus)
        self.session.add(patch_event)
        self.session.commit()

    def soft_delete(
        self,
        *,
        conspectus_uuid: str,
        owner_client_uuid: str,
        invalidation_reason_uuid: str,
        now: datetime,
    ) -> int:
        """Mark the conspectus + schedule as invalid, unlink learner errors.

        Args:
            conspectus_uuid: Row to soft-delete.
            owner_client_uuid: Owner scope (guards against cross-tenant deletes).
            invalidation_reason_uuid: FK into ``invalidation_reasons``.
            now: UTC timestamp for ``invalidated_at`` / ``updated_at``.

        Returns:
            Number of ``learning_errors`` rows that had their ``conspectus_uuid`` unlinked.
        """
        self.session.execute(
            update(Conspectus)
            .where(
                Conspectus.conspectus_uuid == conspectus_uuid,
                Conspectus.owner_client_uuid == owner_client_uuid,
            )
            .values(
                is_row_invalid=1,
                invalidation_reason_uuid=invalidation_reason_uuid,
                invalidated_at=now,
                updated_at=now,
            )
        )
        self.session.execute(
            update(ConspectusSchedule)
            .where(ConspectusSchedule.conspectus_uuid == conspectus_uuid)
            .values(is_row_invalid=1, schedule_updated_at=now)
        )
        unlink_result = self.session.execute(
            update(LearningError)
            .where(LearningError.conspectus_uuid == conspectus_uuid)
            .values(conspectus_uuid=None)
        )
        self.session.commit()
        return int(unlink_result.rowcount or 0)

    def commit_review(
        self,
        *,
        conspectus_uuid: str,
        expected_revision: int,
        new_values: dict[str, object],
        review_log: ConspectusReviewLog,
    ) -> bool:
        """Apply a review transition under optimistic concurrency control.

        Args:
            conspectus_uuid: PK of the schedule row to update.
            expected_revision: Revision the caller believed to be current (CAS guard).
            new_values: Column-name → new-value dict for the ``UPDATE``.
            review_log: Audit row to append when the CAS succeeds.

        Returns:
            ``True`` if the guarded UPDATE affected exactly one row; ``False`` when
            another writer beat us and the revision no longer matches. On ``False``
            the transaction is rolled back so nothing is left half-applied.
        """
        update_stmt = (
            update(ConspectusSchedule)
            .where(
                ConspectusSchedule.conspectus_uuid == conspectus_uuid,
                ConspectusSchedule.schedule_revision == expected_revision,
            )
            .values(**new_values)
        )
        rowcount = int(self.session.execute(update_stmt).rowcount or 0)
        if rowcount != 1:
            self.session.rollback()
            return False
        self.session.add(review_log)
        self.session.commit()
        return True

    # ---------- history ----------

    def list_history(
        self,
        *,
        conspectus_uuid: str,
        limit: int,
        event_type: HistoryEventKind | None,
        since: datetime | None,
        cursor: tuple[datetime, str] | None,
    ) -> list[HistoryRow]:
        """Merge review logs + content events, ordered oldest first.

        The Python-side merge keeps the SQL simple and works portably across dialects.
        Fetches ``limit + 1`` rows so the caller can compute ``has_more`` cleanly.
        Ordering key is ``(created_at, event_id)`` where ``event_id`` retains its
        ``r<n>`` / ``e<n>`` prefix; the cursor is that same pair, so keyset paging is
        just a strict tuple comparison.
        """
        rows: list[HistoryRow] = []
        if event_type is None or event_type == "review":
            rows.extend(self._collect_reviews(conspectus_uuid=conspectus_uuid, since=since))
        if event_type is None or event_type == "content_patch":
            rows.extend(self._collect_content_events(conspectus_uuid=conspectus_uuid, since=since))

        rows.sort(key=lambda row: (row.created_at, row.event_id))
        if cursor is not None:
            rows = [row for row in rows if (row.created_at, row.event_id) > cursor]
        return rows[: limit + 1]

    def _collect_reviews(
        self,
        *,
        conspectus_uuid: str,
        since: datetime | None,
    ) -> list[HistoryRow]:
        stmt = select(ConspectusReviewLog).where(
            ConspectusReviewLog.conspectus_uuid == conspectus_uuid,
        )
        if since is not None:
            stmt = stmt.where(ConspectusReviewLog.created_at >= since)
        stmt = stmt.order_by(ConspectusReviewLog.created_at.asc(), ConspectusReviewLog.id.asc())
        return [
            HistoryRow(
                event_id=f"r{row.id}",
                event_type="review",
                created_at=row.created_at,
                actor_system_user_id=row.actor_system_user_id,
                actor_system_uuid=row.actor_system_uuid,
                tag=row.tag,
                slot_before=row.slot_before,
                slot_after=row.slot_after,
                slot_d_ladder_index_before=row.slot_d_ladder_index_before,
                slot_d_ladder_index_after=row.slot_d_ladder_index_after,
                schedule_revision_after=row.schedule_revision_after,
                next_review_at_after=row.next_review_at_after,
                changed_fields=None,
                content_version_after=None,
            )
            for row in self.session.execute(stmt).scalars().all()
        ]

    def _collect_content_events(
        self,
        *,
        conspectus_uuid: str,
        since: datetime | None,
    ) -> list[HistoryRow]:
        stmt = select(ConspectusEvent).where(
            ConspectusEvent.conspectus_uuid == conspectus_uuid,
            ConspectusEvent.event_type == "CONTENT_PATCHED",
        )
        if since is not None:
            stmt = stmt.where(ConspectusEvent.created_at >= since)
        stmt = stmt.order_by(ConspectusEvent.created_at.asc(), ConspectusEvent.id.asc())
        rows: list[HistoryRow] = []
        for row in self.session.execute(stmt).scalars().all():
            changed_fields = None
            if isinstance(row.payload, dict):
                raw = row.payload.get("changed_fields")
                if isinstance(raw, list):
                    changed_fields = [str(item) for item in raw]
            rows.append(
                HistoryRow(
                    event_id=f"e{row.id}",
                    event_type="content_patch",
                    created_at=row.created_at,
                    actor_system_user_id=row.actor_system_user_id,
                    actor_system_uuid=row.actor_system_uuid,
                    tag=None,
                    slot_before=None,
                    slot_after=None,
                    slot_d_ladder_index_before=None,
                    slot_d_ladder_index_after=None,
                    schedule_revision_after=None,
                    next_review_at_after=None,
                    changed_fields=changed_fields,
                    content_version_after=row.content_version_after,
                )
            )
        return rows
