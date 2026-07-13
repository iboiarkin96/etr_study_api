"""ETR review-schedule state machine.

Pure logic (no ORM / no FastAPI). Encodes the reference policy
``etr_methodology_four_slot`` version ``1.0.0`` from the internal spec:
A → B → C → D ladder, with fallbacks on ``hard`` / ``forgot``.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Literal

# Public identifiers pinned into every ConspectusSchedule row + review log.
SCHEDULE_POLICY_ID: str = "etr_methodology_four_slot"
SCHEDULE_POLICY_VERSION: str = "1.0.0"
ALGORITHM_VERSION: str = "v1"

Slot = Literal["A", "B", "C", "D"]
ReviewTag = Literal["easy", "hard", "forgot"]

# Rungs of slot D — delay grows the longer the learner keeps hitting easy.
_SLOT_D_DELAYS: tuple[timedelta, ...] = (
    timedelta(days=7),  # rung 0 (entry: promoted C -> D)
    timedelta(days=14),  # rung 1
    timedelta(days=30),  # rung 2
    timedelta(days=60),  # rung 3 and above (capped)
)

# Delay applied when the schedule *first* lands in a non-D slot after a transition.
_SLOT_ENTRY_DELAY: dict[Slot, timedelta] = {
    "A": timedelta(hours=1),
    "B": timedelta(days=1),
    "C": timedelta(days=3),
    # D uses the ladder table above, not this map.
    "D": timedelta(days=7),
}


@dataclass(frozen=True, slots=True)
class ScheduleState:
    """A schedule position after a transition.

    Attributes:
        slot: Current ETR slot (A / B / C / D).
        slot_d_ladder_index: Rung within slot D (0-based; ignored outside D).
        delay: Time until the next review from the moment the transition is committed.
    """

    slot: Slot
    slot_d_ladder_index: int
    delay: timedelta


def initial_state() -> ScheduleState:
    """Return the starting state for a freshly created conspectus.

    Returns:
        State ``(slot=A, ladder=0, delay=PT1H)``; next review one hour after create.
    """
    return ScheduleState(slot="A", slot_d_ladder_index=0, delay=_SLOT_ENTRY_DELAY["A"])


def apply_review(current_slot: Slot, current_d_index: int, tag: ReviewTag) -> ScheduleState:
    """Compute the next schedule state from ``(current_slot, ladder, tag)``.

    Args:
        current_slot: Slot before the review.
        current_d_index: Ladder rung inside slot D (0 outside D).
        tag: Learner's review outcome — ``easy`` / ``hard`` / ``forgot``.

    Returns:
        Immutable :class:`ScheduleState` describing the new slot and delay.
    """
    if tag == "forgot":
        return ScheduleState(slot="A", slot_d_ladder_index=0, delay=_SLOT_ENTRY_DELAY["A"])

    if tag == "easy":
        if current_slot == "A":
            return ScheduleState(slot="B", slot_d_ladder_index=0, delay=_SLOT_ENTRY_DELAY["B"])
        if current_slot == "B":
            return ScheduleState(slot="C", slot_d_ladder_index=0, delay=_SLOT_ENTRY_DELAY["C"])
        if current_slot == "C":
            return ScheduleState(slot="D", slot_d_ladder_index=0, delay=_SLOT_D_DELAYS[0])
        # D: advance the ladder, cap at the last rung.
        next_index = min(current_d_index + 1, len(_SLOT_D_DELAYS) - 1)
        return ScheduleState(
            slot="D", slot_d_ladder_index=next_index, delay=_SLOT_D_DELAYS[next_index]
        )

    # tag == "hard"
    if current_slot == "A":
        return ScheduleState(slot="A", slot_d_ladder_index=0, delay=_SLOT_ENTRY_DELAY["A"])
    if current_slot == "B":
        return ScheduleState(slot="A", slot_d_ladder_index=0, delay=_SLOT_ENTRY_DELAY["A"])
    if current_slot == "C":
        return ScheduleState(slot="B", slot_d_ladder_index=0, delay=_SLOT_ENTRY_DELAY["B"])
    # D
    return ScheduleState(slot="C", slot_d_ladder_index=0, delay=_SLOT_ENTRY_DELAY["C"])
