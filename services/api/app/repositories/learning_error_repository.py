"""Data access layer for the append-only ``learning_errors`` table."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core.conspectus import Conspectus, ConspectusReviewLog
from app.models.core.learning_error import LearningError


class LearningErrorRepository:
    """Persistence + read helpers for :class:`~app.models.core.learning_error.LearningError`."""

    _LIST_HARD_CAP: int = 100

    def __init__(self, session: Session) -> None:
        """Bind the repository to a SQLAlchemy session.

        Args:
            session: Active DB session owned by the caller.
        """
        self.session = session

    def conspectus_owned_by(self, conspectus_uuid: str, owner_client_uuid: str) -> bool:
        """Return ``True`` iff the conspectus exists and belongs to the given owner.

        Args:
            conspectus_uuid: Candidate FK from the request body.
            owner_client_uuid: Resolved owner client UUID.

        Returns:
            ``True`` when the row exists under this owner (soft-deleted included).
        """
        stmt = select(Conspectus.conspectus_uuid).where(
            Conspectus.conspectus_uuid == conspectus_uuid,
            Conspectus.owner_client_uuid == owner_client_uuid,
        )
        return self.session.execute(stmt).scalar_one_or_none() is not None

    def review_log_owned_by(self, review_log_id: int, owner_client_uuid: str) -> bool:
        """Return ``True`` iff the review log row exists under this owner.

        Args:
            review_log_id: Candidate FK from the request body.
            owner_client_uuid: Resolved owner client UUID.

        Returns:
            ``True`` when the row exists under this owner.
        """
        stmt = select(ConspectusReviewLog.id).where(
            ConspectusReviewLog.id == review_log_id,
            ConspectusReviewLog.owner_client_uuid == owner_client_uuid,
        )
        return self.session.execute(stmt).scalar_one_or_none() is not None

    def save(self, entity: LearningError) -> LearningError:
        """Insert a new row, commit, and refresh from the DB.

        Args:
            entity: Transient :class:`LearningError` to persist.

        Returns:
            The refreshed entity with server-side defaults populated.
        """
        self.session.add(entity)
        self.session.commit()
        self.session.refresh(entity)
        return entity

    def list_by_owner(
        self,
        *,
        owner_client_uuid: str,
        conspectus_uuid: str | None = None,
    ) -> list[LearningError]:
        """Load up to 100 errors for the owner, newest first, optional conspectus filter.

        Args:
            owner_client_uuid: Owner scope; enforced in the WHERE clause.
            conspectus_uuid: Optional exact-match filter on the linked note.

        Returns:
            List of :class:`LearningError`; up to :attr:`_LIST_HARD_CAP` rows.
        """
        stmt = select(LearningError).where(
            LearningError.owner_client_uuid == owner_client_uuid,
        )
        if conspectus_uuid is not None:
            stmt = stmt.where(LearningError.conspectus_uuid == conspectus_uuid)
        stmt = stmt.order_by(
            LearningError.created_at.desc(),
            LearningError.error_uuid.desc(),
        ).limit(self._LIST_HARD_CAP)
        return list(self.session.execute(stmt).scalars().all())
