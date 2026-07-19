"""Seed a handful of conspectuses for the local dev loop.

Populates the DB with 8 conspectuses whose schedule rows span the four
regions the Today screen shows differently:

* 2 rows overdue           → contribute to ``schedule/summary.due_now``
* 2 rows due in the next 6h → also ``due_now``
* 2 rows due in 24h         → ``due_next_24h``
* 2 rows due in 3d / 7d     → only counted in ``total``

Slot distribution (A × 2, B × 2, C × 2, D × 2) makes ``by_slot`` non-trivial
so the strip renders with variety. Content shape (``cue_sheet`` / ``dense_paragraph``
/ ``bullets``) matches the API contract but is intentionally minimal — just
enough for the UI to render titles + slot chips.

Idempotency
-----------

Each seed row has a stable ``conspectus_uuid`` prefixed with ``dev-seed-``. On
re-run the script does ``INSERT ... ON CONFLICT DO NOTHING`` (per row set), so
calling it twice is a no-op. Pass ``--reset`` to wipe seeds before re-inserting
(safe: only touches rows whose uuid starts with the seed prefix).

Prerequisites
-------------

The Telegram user this seed targets **must exist**. Log in from the Mini App
once (or POST ``initData`` to ``/api/v1/auth/telegram``) so ``users`` +
``telegram_users`` rows are created. Otherwise the script exits with a clear
error pointing you at the fix.

Usage
-----

Host-side (Postgres exposed on ``localhost:5432``)::

    DATABASE_URL=postgresql+psycopg://study_app:study_app@localhost:5432/study_app \
        python tools/dev/seed_dev_data.py

Container-side (from inside ``study-app-api``)::

    docker cp tools/dev/seed_dev_data.py study-app-api:/tmp/
    docker exec -it study-app-api python /tmp/seed_dev_data.py

Common flags::

    --telegram-user-id 12345   Target Telegram user (default matches sign_init_data.py's dev default)
    --reset                    Wipe rows with uuid prefix ``dev-seed-`` before insert
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_API_ROOT = _REPO_ROOT / "services" / "api"
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

from app.domain.scheduling import (  # noqa: E402
    ALGORITHM_VERSION,
    SCHEDULE_POLICY_ID,
    SCHEDULE_POLICY_VERSION,
)
from app.models.core.conspectus import (  # noqa: E402
    Conspectus,
    ConspectusEvent,
    ConspectusSchedule,
)
from app.models.core.telegram_user import TelegramUser  # noqa: E402
from sqlalchemy import create_engine, delete, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

TELEGRAM_SYSTEM_UUID = "00000000-0000-4000-8000-000000000001"
SEED_UUID_PREFIX = "dev-seed-"

# (uuid_suffix, title, slot, ladder_index, next_review_offset)
_SEED_ROWS: tuple[tuple[str, str, str, int, timedelta], ...] = (
    ("a1", "Правило трёх на прогулке", "A", 0, timedelta(days=-1)),
    ("a2", "Утренний ритуал: 3 приоритета", "A", 0, timedelta(hours=-3)),
    ("b1", "Индексы в PostgreSQL: BRIN vs GIN", "B", 0, timedelta(hours=2)),
    ("b2", "Что такое SLI/SLO/SLA", "B", 0, timedelta(hours=5)),
    ("c1", "Диаграмма C4: 4 уровня", "C", 0, timedelta(hours=20)),
    ("c2", "TCP handshake и close_wait", "C", 0, timedelta(hours=22)),
    ("d1", "ETR: 4 слота A→B→C→D", "D", 0, timedelta(days=3)),
    ("d2", "Диатакси: 4 квадранта", "D", 1, timedelta(days=7)),
)


def _cue_sheet(title: str) -> dict:
    return {"prompts": [{"kind": "recall", "text": title}]}


def _bullets(title: str) -> list[str]:
    return [
        f"Ключевая идея: {title}.",
        "Ассоциация или пример из практики.",
    ]


def _dense_paragraph(title: str) -> str:
    return (
        f"{title} — dev-seed conspectus. Replace this text with a real ETR note "
        "when you exit the seed loop; the shape matches the production schema."
    )


def _resolve_database_url() -> str:
    """Read DATABASE_URL from env, defaulting to host-side compose defaults."""
    return os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://study_app:study_app@localhost:5432/study_app",
    )


def _resolve_owner(session: Session, telegram_user_id: int) -> str:
    """Return ``client_uuid`` for the given Telegram user, or exit with help.

    The seed intentionally does NOT create the user row — that path lives in
    ``/api/v1/auth/telegram`` and creating it here would let the seed diverge
    from the real auth flow.
    """
    row = session.execute(
        select(TelegramUser.client_uuid).where(TelegramUser.telegram_user_id == telegram_user_id)
    ).scalar_one_or_none()
    if row is None:
        sys.exit(
            f"[seed] no telegram_user row for telegram_user_id={telegram_user_id}. "
            "Log in from the Mini App once (or POST initData to /api/v1/auth/telegram) "
            "so users + telegram_users get created, then re-run this script."
        )
    return row


def _wipe_seeds(session: Session) -> int:
    """Delete every row whose uuid starts with the seed prefix. Returns row count."""
    result = session.execute(
        delete(Conspectus).where(Conspectus.conspectus_uuid.like(f"{SEED_UUID_PREFIX}%"))
    )
    session.commit()
    return result.rowcount or 0


def _insert_seeds(session: Session, owner_client_uuid: str, telegram_user_id: int) -> int:
    """Insert missing seed rows. Returns count of rows actually inserted."""
    inserted = 0
    now = datetime.now(UTC)
    for suffix, title, slot, ladder, offset in _SEED_ROWS:
        conspectus_uuid = f"{SEED_UUID_PREFIX}{suffix}"
        exists = session.get(Conspectus, conspectus_uuid)
        if exists is not None:
            continue

        conspectus = Conspectus(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
            title=title,
            cue_sheet=_cue_sheet(title),
            cue_sheet_schema_version=1,
            dense_paragraph=_dense_paragraph(title),
            bullets=_bullets(title),
            content_version=1,
            created_at=now,
            updated_at=now,
            is_row_invalid=0,
        )
        schedule = ConspectusSchedule(
            conspectus_uuid=conspectus_uuid,
            owner_client_uuid=owner_client_uuid,
            slot=slot,
            slot_d_ladder_index=ladder,
            next_review_at=now + offset,
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
            payload={"source": "dev-seed"},
            content_version_after=1,
            actor_system_user_id=str(telegram_user_id),
            actor_system_uuid=TELEGRAM_SYSTEM_UUID,
            created_at=now,
        )
        session.add_all([conspectus, schedule, event])
        inserted += 1

    session.commit()
    return inserted


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="seed_dev_data",
        description="Seed dev conspectuses so the Today screen renders non-empty state.",
    )
    parser.add_argument(
        "--telegram-user-id",
        type=int,
        default=12345,
        help="Telegram user id whose Today should be populated (default: 12345).",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help=f"Delete existing seed rows (uuid prefix '{SEED_UUID_PREFIX}') before inserting.",
    )
    return parser


def main() -> None:
    args = _build_parser().parse_args()

    database_url = _resolve_database_url()
    print(f"[seed] connecting to {database_url.rsplit('@', 1)[-1]}")

    engine = create_engine(database_url, future=True, pool_pre_ping=True)
    with Session(engine) as session:
        owner = _resolve_owner(session, args.telegram_user_id)
        print(f"[seed] owner client_uuid={owner} (telegram_user_id={args.telegram_user_id})")

        if args.reset:
            wiped = _wipe_seeds(session)
            print(f"[seed] wiped {wiped} pre-existing seed row(s)")

        inserted = _insert_seeds(session, owner, args.telegram_user_id)
        skipped = len(_SEED_ROWS) - inserted
        print(f"[seed] inserted {inserted} conspectus(es); skipped {skipped} (already present)")
        print(
            "[seed] done. Refresh the Mini App — Today should now show "
            f"{len(_SEED_ROWS)} entries with due_now / due_next_24h / total > 0."
        )


if __name__ == "__main__":
    main()
