"""Business logic for the Schedule projection endpoints."""

from __future__ import annotations

import base64
import hashlib
import logging
import random
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.repositories.schedule_repository import ScheduleRepository
from app.schemas.schedule import (
    SchedulePreviewItem,
    SchedulePreviewResponse,
    ScheduleSummaryResponse,
    ScheduleSummarySlotCounts,
    WindowLiteral,
)

logger = logging.getLogger(__name__)

_WINDOW_DURATIONS: dict[str, timedelta] = {
    "PT1H": timedelta(hours=1),
    "PT4H": timedelta(hours=4),
    "PT24H": timedelta(hours=24),
    "P1D": timedelta(hours=24),
}


@dataclass(frozen=True, slots=True)
class SchedulePreviewInputs:
    """Bundle of validated preview request parameters."""

    window: WindowLiteral
    limit: int
    random_seed: str | None


class ScheduleService:
    """Read-only projections over ``conspectus_schedules``."""

    def __init__(self, repository: ScheduleRepository) -> None:
        """Bind to a repository.

        Args:
            repository: Data-access instance for this request.
        """
        self.repository = repository

    def summary(self, *, owner_client_uuid: str) -> ScheduleSummaryResponse:
        """Compute the ``/schedule/summary`` payload for one learner.

        Args:
            owner_client_uuid: Resolved owner scope.

        Returns:
            :class:`ScheduleSummaryResponse` with slot counts + due-window counts.
        """
        now = datetime.now(UTC)
        counts = self.repository.counts_by_slot(owner_client_uuid)
        by_slot = ScheduleSummarySlotCounts(
            A=counts.get("A", 0),
            B=counts.get("B", 0),
            C=counts.get("C", 0),
            D=counts.get("D", 0),
        )
        total = by_slot.A + by_slot.B + by_slot.C + by_slot.D
        due_now = self.repository.count_in_window(owner_client_uuid, start=None, end=now)
        due_next_24h = self.repository.count_in_window(
            owner_client_uuid,
            start=now,
            end=now + timedelta(hours=24),
        )
        return ScheduleSummaryResponse(
            by_slot=by_slot,
            due_now=due_now,
            due_next_24h=due_next_24h,
            total=total,
            computed_at=now,
        )

    def preview(
        self,
        *,
        owner_client_uuid: str,
        inputs: SchedulePreviewInputs,
    ) -> SchedulePreviewResponse:
        """Compute the ``/schedule/preview`` payload — window scan + deterministic shuffle.

        Determinism boundary: same ``random_seed`` within the same clock minute yields the
        same order. A minute later the derived seed changes so the client can refresh.

        Args:
            owner_client_uuid: Resolved owner scope.
            inputs: Validated request parameters.

        Returns:
            :class:`SchedulePreviewResponse` with 0..``limit`` items and ``random_seed``
            echoed (server-generated when omitted).
        """
        now = datetime.now(UTC)
        window_delta = _WINDOW_DURATIONS[inputs.window]
        until = now + window_delta
        candidates = self.repository.preview_candidates(owner_client_uuid, until=until)
        seed = inputs.random_seed if inputs.random_seed is not None else _generate_seed()

        indices = list(range(len(candidates)))
        random.Random(_derive_seed(seed, now)).shuffle(indices)
        top = indices[: inputs.limit]

        items = [
            SchedulePreviewItem(
                preview_order_index=order_index,
                conspectus_uuid=candidates[picked].conspectus_uuid,
                title=candidates[picked].title,
                slot=candidates[picked].slot,
                next_review_at=candidates[picked].next_review_at,
            )
            for order_index, picked in enumerate(top)
        ]
        return SchedulePreviewResponse(
            window=inputs.window,
            computed_at=now,
            random_seed=seed,
            count=len(items),
            items=items,
        )


def _generate_seed() -> str:
    """Produce a URL-safe base64 22-char slug from a random UUIDv4."""
    return base64.urlsafe_b64encode(uuid.uuid4().bytes).decode("ascii").rstrip("=")


def _derive_seed(seed: str, moment: datetime) -> int:
    """Combine ``seed`` with the current clock minute to drive a deterministic shuffle.

    Args:
        seed: Client-supplied or server-generated seed slug.
        moment: Reference timestamp (must be UTC-aware).

    Returns:
        64-bit integer seed suitable for :class:`random.Random`.
    """
    key = f"{seed}|{moment.strftime('%Y-%m-%dT%H:%M')}".encode()
    digest = hashlib.blake2b(key, digest_size=8).digest()
    return int.from_bytes(digest, "big", signed=False)
